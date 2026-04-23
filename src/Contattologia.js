/* global __firebase_config, __app_id */
// ===================================================================================
// --- FILE CONDIVISO: UTILITIES + SEZIONE CONTATTOLOGIA ---
// Questo file contiene: config Firebase, hooks, componenti UI generici e la
// sezione Contattologia. Gli altri moduli importano le utilities da qui.
// ===================================================================================

import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    getFirestore, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot,
    collection, query, writeBatch, getDocs, updateDoc, orderBy
} from 'firebase/firestore';
import {
    Trash2, PlusCircle, X, Calendar, Edit, Eye, Search, Beaker, Glasses,
    AlertTriangle, CheckCircle, Contact, FileDown, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "AIzaSyAz1cXMg65gTQa8AoFAJ2Q4esaH-jr5BPQ",
        authDomain: "console-visionottica.firebaseapp.com",
        projectId: "console-visionottica",
        storageBucket: "console-visionottica.appspot.com",
        messagingSenderId: "728377857506",
        appId: "1:728377857506:web:e13fddc017719656a015bb"
      };

// --- INIZIALIZZAZIONE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// FORZIAMO IL PERCORSO PER RISOLVERE IL BUG DEGLI SCREENSHOT
const appId = 'default-app-id';
window.mioCodiceUtente = ''; // Variabile globale sicura per ricollegare il database

// --- HELPERS E HOOKS FIREBASE ---
const getCollectionRef = (collectionName) => {
    const userId = window.mioCodiceUtente || auth.currentUser?.uid;
    if (!userId) throw new Error("Utente non autenticato.");
    return collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
};

const getDocumentRef = (collectionName, docId) => {
    const userId = window.mioCodiceUtente || auth.currentUser?.uid;
    if (!userId) throw new Error("Utente non autenticato.");
    return doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, docId);
};

// Collezione polos condivisa (non per-utente)
const getPolosRef = () => collection(db, `artifacts/${appId}/polos`);

const usePolos = () => {
    const [polos, setPolos] = React.useState([]);
    React.useEffect(() => {
        const q = query(collection(db, `artifacts/${appId}/polos`), orderBy('codice'));
        const unsub = onSnapshot(q, snap => {
            setPolos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {});
        return unsub;
    }, []);
    return polos;
};

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const useFirestoreCollection = (collectionName, isAuthReady, refreshTrigger = 0, options = {}) => {
    const [data, setData] = React.useState([]);
    React.useEffect(() => {
        if (!isAuthReady || !auth.currentUser || !collectionName) {
            setData([]);
            return;
        }
        const userId = window.mioCodiceUtente || auth.currentUser?.uid;
        if (!userId) return;

        const collectionPath = `artifacts/${appId}/users/${userId}/${collectionName}`;
        let q = query(collection(db, collectionPath));

        if (options.orderBy) {
             q = query(collection(db, collectionPath), orderBy(options.orderBy, options.orderDirection || 'asc'));
        }

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setData(items);
        }, (error) => {
            console.error(`Errore nel caricamento della collezione ${collectionName}:`, error);
            toast.error(`Errore caricamento dati: ${collectionName}`);
        });
        return () => unsubscribe();
    }, [collectionName, isAuthReady, options.orderBy, options.orderDirection, refreshTrigger]);
    return data;
};

// NUOVO HELPER PER LA GENERAZIONE DI PDF
const generateSalesPdf = (salesData, title = 'Report Vendite Dettagliato') => {
    if (salesData.length === 0) {
        toast.error("Nessun dato di vendita da esportare in PDF.");
        return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
        toast.error("Libreria PDF (jsPDF) non disponibile.");
        return;
    }

    try {
        const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
        doc.text(title, 14, 16);
        const body = salesData.map(v => [
            v.data,
            v.cliente,
            v.venditore,
            v.tipo_lente,
            v.ordine_lente,
            v.numero_ordine,
            (v.importo || 0).toFixed(2) + ' €',
            (v.trattamenti || []).join(', ')
        ]);

        doc.autoTable({
            head: [['Data', 'Cliente', 'Venditore', 'Tipo Lente', 'Ordine', 'N. Ordine', 'Importo', 'Trattamenti']],
            body: body,
            startY: 20,
            theme: 'striped',
            styles: { fontSize: 8 }
        });

        const fileName = `Dettaglio_Vendite_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        toast.success("PDF con i dettagli scaricato!");
    } catch (error) {
        console.error("Errore durante la generazione del PDF:", error);
        toast.error(`Impossibile generare il PDF: ${error.message}`);
    }
};

// --- COMPONENTI UI GENERICI ---
const Modal = ({ isOpen, onClose, title, children, size = 'max-w-lg', zIndex = 'z-50' }) => {
    if (!isOpen) return null;
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center ${zIndex} p-2 md:p-4 animate-fade-in`}>
            <div className={`bg-white rounded-lg shadow-xl w-full ${size} mx-2 md:mx-4 max-h-[92vh] flex flex-col transform transition-transform duration-300 animate-fade-in-up`}>
                <div className="flex justify-between items-center border-b pb-3 px-4 pt-4 md:px-6 md:pt-6 flex-shrink-0">
                    <h4 className="text-xl font-semibold text-gray-800">{title}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0 ml-2"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto flex-1 px-4 pb-4 md:px-6 md:pb-6 pt-4">{children}</div>
            </div>
        </div>
    );
};

const AlertModal = ({ isOpen, onClose, title, message, type = 'info' }) => {
    if (!isOpen) return null;
    const icons = {
        success: <CheckCircle className="text-green-500" size={32} />,
        error: <AlertTriangle className="text-red-500" size={32} />,
        info: <AlertTriangle className="text-blue-500" size={32} />,
    };
    const colors = {
        success: 'bg-green-500 hover:bg-green-600',
        error: 'bg-red-500 hover:bg-red-600',
        info: 'bg-blue-500 hover:bg-blue-600',
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col items-center text-center">
                {icons[type]}
                <p className="text-gray-700 my-4 whitespace-pre-wrap">{message}</p>
                <Button onClick={onClose} className={colors[type]}>OK</Button>
            </div>
        </Modal>
    );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message, confirmIsLoading = false }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} zIndex="z-[60]">
            <div className="text-center">
                <p className="text-gray-700 my-4">{message}</p>
                <div className="flex justify-center gap-4 mt-6">
                    <Button onClick={onCancel} variant="neutral" disabled={confirmIsLoading}>Annulla</Button>
                    <Button onClick={onConfirm} variant="danger" isLoading={confirmIsLoading}>Conferma</Button>
                </div>
            </div>
        </Modal>
    );
};

const useConfirmation = (title = "Conferma Operazione") => {
    const [confirmState, setConfirmState] = React.useState({ isOpen: false, message: '', onConfirm: () => {}, isLoading: false });

    const requestConfirmation = (message, onConfirm) => {
        setConfirmState({
            isOpen: true,
            message,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, isLoading: true }));
                try {
                    await onConfirm();
                } finally {
                    setConfirmState({ isOpen: false, message: '', onConfirm: () => {}, isLoading: false });
                }
            }
        });
    };

    const closeConfirmation = () => setConfirmState({ isOpen: false, message: '', onConfirm: () => {}, isLoading: false });

    const ConfirmationDialog = () => (
        <ConfirmModal
            isOpen={confirmState.isOpen}
            onCancel={closeConfirmation}
            onConfirm={confirmState.onConfirm}
            title={title}
            message={confirmState.message}
            confirmIsLoading={confirmState.isLoading}
        />
    );

    return [ConfirmationDialog, requestConfirmation];
};

const Button = ({ onClick, children, className = '', icon: Icon, type = "button", disabled = false, variant = 'primary', isLoading = false }) => {
    const baseStyles = "flex items-center justify-center gap-2 px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105";
    const disabledStyles = "opacity-50 cursor-not-allowed";
    
    const variants = {
        primary: 'bg-blue-600 hover:bg-blue-700',
        success: 'bg-green-600 hover:bg-green-700',
        danger: 'bg-red-600 hover:bg-red-700',
        neutral: 'bg-gray-500 hover:bg-gray-600',
        warning: 'bg-orange-500 hover:bg-orange-600',
        indigo: 'bg-indigo-500 hover:bg-indigo-600',
        teal: 'bg-teal-500 hover:bg-teal-600',
        sky: 'bg-sky-500 hover:bg-sky-500',
        slate: 'bg-slate-600 hover:bg-slate-700',
    };
    
    const spinner = <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>;
    const variantStyles = variants[variant] || variants.primary;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`${baseStyles} ${variantStyles} ${disabled || isLoading ? disabledStyles : ''} ${className}`}
        >
            {isLoading ? spinner : (
                <>
                    {Icon && <Icon size={18} />}
                    {children}
                </>
            )}
        </button>
    );
};

const Input = React.forwardRef((props, ref) => (
    <input ref={ref} {...props} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2" />
));
Input.displayName = 'Input';

const Select = (props) => <select {...props} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2" />;

const TextArea = React.forwardRef((props, ref) => (
    <textarea ref={ref} {...props} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2" />
));
TextArea.displayName = 'TextArea';

const StatCard = ({ title, children, className }) => (
    <div className={`bg-white p-4 rounded-lg shadow-md border-l-4 ${className}`}>
        <h4 className="font-bold text-lg text-gray-700 border-b pb-2 mb-2">{title}</h4>
        <div className="space-y-1 text-sm">{children}</div>
    </div>
);

const TabButton = ({ tabName, label, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tabName)}
        className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
            activeTab === tabName
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
    >
        {label}
    </button>
);

// ===================================================================================
// --- SEZIONE CONTATTOLOGIA ---
// ===================================================================================

const AddEditContattoModal = ({ isOpen, onClose, contatto, onSave, initialType = 'vendita' }) => {
    const [formData, setFormData] = React.useState({ tipo: initialType, cliente: '', recapito: '', rif_vaschetta: '', note: '', lenti: [] });
    const [isSaving, setIsSaving] = React.useState(false);
    
    React.useEffect(() => {
        if (contatto) {
            setFormData({
                tipo: contatto.tipo || 'vendita',
                cliente: contatto.cliente || '',
                recapito: contatto.recapito || '',
                rif_vaschetta: contatto.rif_vaschetta || '',
                note: contatto.note || '',
                lenti: contatto.lenti || []
            });
        } else {
            setFormData({ tipo: initialType, cliente: '', recapito: '', rif_vaschetta: '', note: '', lenti: [] });
        }
    }, [contatto, initialType, isOpen]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLensChange = (index, e) => {
        const { name, value } = e.target;
        const newLenti = [...formData.lenti];
        newLenti[index] = { ...newLenti[index], [name]: value };
        setFormData(prev => ({...prev, lenti: newLenti}));
    };
    
    const addLens = () => {
        const newLens = { 
            id: Date.now(),
            prodotto: '', 
            potere: '', 
            data_acquisto: new Date().toISOString().slice(0, 10),
            durata_mesi: '6' 
        };
        setFormData(prev => ({ ...prev, lenti: [...prev.lenti, newLens] }));
    };

    const removeLens = (index) => {
        const newLenti = formData.lenti.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, lenti: newLenti }));
    };

    const handleSubmit = async () => {
        if (!formData.cliente) {
            toast.error('Il nome del cliente è obbligatorio.');
            return;
        }
        setIsSaving(true);
        
        const lentiToSave = formData.lenti.map(({ id, ...rest }) => rest);
        const dataToSave = {...formData, lenti: lentiToSave };

        try {
            if (contatto) {
                await updateDoc(getDocumentRef('contatti_lenti', contatto.id), dataToSave);
            } else {
                await addDoc(getCollectionRef('contatti_lenti'), dataToSave);
            }
            toast.success('Cliente salvato con successo!');
            onSave();
        } catch (error) {
            toast.error(`Impossibile salvare: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={contatto ? 'Modifica Cliente' : 'Nuovo Cliente Contattologia'} size="max-w-3xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label>Tipo</label>
                        <Select name="tipo" value={formData.tipo} onChange={handleFormChange}>
                            <option value="vendita">Vendita LAC</option>
                            <option value="prova">Prova LAC</option>
                        </Select>
                    </div>
                    <div><label>Nome Cliente</label><Input name="cliente" value={formData.cliente} onChange={handleFormChange} required /></div>
                    <div><label>Rif. Vaschetta (3 cifre)</label><Input name="rif_vaschetta" value={formData.rif_vaschetta} onChange={handleFormChange} pattern="\d{3}" maxLength="3" /></div>
                </div>
                <div><label>Recapito (Tel/Email)</label><Input name="recapito" value={formData.recapito} onChange={handleFormChange} /></div>
                <div><label>Note Generali</label><TextArea name="note" value={formData.note} onChange={handleFormChange} rows="2"/></div>

                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-lg">Lenti a Contatto Acquistate/In Prova</h4>
                        <Button onClick={addLens} icon={PlusCircle} variant="teal">Aggiungi Lente</Button>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-md">
                        {formData.lenti.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Nessuna lente registrata.</p>}
                        {formData.lenti.map((lente, index) => (
                            <div key={lente.id || index} className="p-3 bg-white rounded shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-3">
                                <div className="md:col-span-2"><label className="text-xs">Prodotto/Marca</label><Input name="prodotto" value={lente.prodotto} onChange={(e) => handleLensChange(index, e)} /></div>
                                <div><label className="text-xs">Potere</label><Input name="potere" value={lente.potere} onChange={(e) => handleLensChange(index, e)} /></div>
                                <div><label className="text-xs">Data Acquisto</label><Input type="date" name="data_acquisto" value={lente.data_acquisto} onChange={(e) => handleLensChange(index, e)} /></div>
                                <div className="flex items-end gap-2">
                                     <div><label className="text-xs">Durata (Mesi)</label><Input type="number" name="durata_mesi" value={lente.durata_mesi} onChange={(e) => handleLensChange(index, e)} /></div>
                                     <Button onClick={() => removeLens(index)} icon={Trash2} variant="danger" className="p-2 h-10"/>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t mt-4">
                    <Button onClick={onClose} variant="neutral" disabled={isSaving}>Annulla</Button>
                    <Button onClick={handleSubmit} variant="success" isLoading={isSaving}>Salva Cliente</Button>
                </div>
            </div>
        </Modal>
    );
};


const Contattologia = ({ contatti, initialAction, onActionComplete }) => {
    const [activeTab, setActiveTab] = React.useState('vendita');
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedContatto, setSelectedContatto] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState('');

    const openModal = (contatto = null) => {
        setSelectedContatto(contatto);
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setSelectedContatto(null);
        setIsModalOpen(false);
    };

    React.useEffect(() => {
        if (initialAction) {
            if (initialAction === 'nuova_vendita_lac') {
                setActiveTab('vendita');
                openModal();
            } else if (initialAction === 'nuova_prova_lac') {
                setActiveTab('prova');
                openModal();
            }
            onActionComplete();
        }
    }, [initialAction, onActionComplete]);

    const calculateScadenza = (lenti) => {
        if (!lenti || lenti.length === 0) return { status: 'N/A', text: 'Nessuna lente', color: 'bg-gray-200 text-gray-800' };

        const piuRecente = lenti.reduce((latest, current) => {
            return new Date(latest.data_acquisto) > new Date(current.data_acquisto) ? latest : current;
        });
        
        const dataAcquisto = new Date(piuRecente.data_acquisto);
        const durataMesi = parseInt(piuRecente.durata_mesi, 10) || 0;
        const dataScadenza = new Date(dataAcquisto.setMonth(dataAcquisto.getMonth() + durataMesi));
        const oggi = new Date();
        const giorniRimanenti = Math.ceil((dataScadenza - oggi) / (1000 * 60 * 60 * 24));

        if (giorniRimanenti < 0) return { status: 'Scaduto', text: `Scaduto da ${-giorniRimanenti} gg`, color: 'bg-red-200 text-red-800' };
        if (giorniRimanenti <= 30) return { status: 'In Scadenza', text: `Scade tra ${giorniRimanenti} gg`, color: 'bg-yellow-200 text-yellow-800' };
        return { status: 'OK', text: `Scade tra ${giorniRimanenti} gg`, color: 'bg-green-200 text-green-800' };
    };
    
    const filteredContatti = contatti
        .filter(c => c.tipo === activeTab)
        .map(c => ({...c, scadenza: calculateScadenza(c.lenti)}))
        .filter(c => c.cliente.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a,b) => {
            const order = { 'Scaduto': 1, 'In Scadenza': 2, 'OK': 3, 'N/A': 4 };
            return order[a.scadenza.status] - order[b.scadenza.status];
        });

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <AddEditContattoModal isOpen={isModalOpen} onClose={closeModal} contatto={selectedContatto} onSave={closeModal} initialType={activeTab} />

            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Contattologia</h2>
                <Button onClick={() => openModal()} icon={PlusCircle} variant="success">Nuovo Cliente</Button>
            </div>
            
            <div className="flex border-b mb-6">
                <TabButton tabName="vendita" label="Vendite LAC" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton tabName="prova" label="Prove LAC" activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

             <div className="mb-6">
                <Input 
                    type="text" 
                    placeholder={`Cerca cliente in ${activeTab === 'vendita' ? 'Vendite' : 'Prove'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="space-y-3">
                {filteredContatti.map(c => (
                    <div key={c.id} className="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                            <p className="font-bold text-lg">{c.cliente}</p>
                            <p className="text-sm text-gray-600">
                                {c.recapito || 'Nessun recapito'}
                                {c.rif_vaschetta && ` • Vaschetta: ${c.rif_vaschetta}`}
                            </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                           <span className={`px-3 py-1 text-sm font-semibold rounded-full ${c.scadenza.color}`}>{c.scadenza.text}</span>
                           <Button onClick={() => openModal(c)} variant="indigo">Dettagli</Button>
                        </div>
                    </div>
                ))}
                {filteredContatti.length === 0 && <p className="text-center text-gray-500 py-8">Nessun cliente trovato.</p>}
            </div>
        </div>
    );
};


// ===================================================================================
// --- EXPORTS ---
// ===================================================================================
export {
    // Firebase
    app, auth, db, appId,
    // Helpers Firebase
    getCollectionRef, getDocumentRef, getPolosRef,
    // Hooks
    useDebounce, useFirestoreCollection, useConfirmation, usePolos,
    // PDF helper
    generateSalesPdf,
    // UI generici
    Modal, AlertModal, ConfirmModal, Button, Input, Select, TextArea, StatCard, TabButton,
    // Contattologia
    AddEditContattoModal, Contattologia
};
