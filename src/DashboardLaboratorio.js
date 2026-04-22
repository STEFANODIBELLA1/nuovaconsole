// ===================================================================================
// --- MODULO: DASHBOARD + LABORATORIO ---
// Contiene: componente Dashboard, modali specifiche del Laboratorio
// (MultiStatusModal, DettagliVenditaModal) e componente Laboratorio.
// ===================================================================================

import React from 'react';
import { updateDoc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';
import {
    PlusCircle, Trash2, ChevronLeft, Search, Eye, Edit, CopyCheck,
    CheckCircle, Settings, List, Contact, Beaker,
    FlaskConical, Archive, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

// Importa utilities e componenti UI condivisi dal file Contattologia
import {
    db, getCollectionRef, getDocumentRef,
    useDebounce, useConfirmation,
    Modal, Button, Input, Select, TextArea, StatCard,
    AddEditContattoModal
} from './Contattologia';

// ===================================================================================
// --- SEZIONE DASHBOARD ---
// ===================================================================================

const Dashboard = ({ vendite, riparazioni, obiettivi, onNavigate }) => {
    const stats = React.useMemo(() => {
        const oggi = new Date();
        const meseCorrente = oggi.getMonth();
        const annoCorrente = oggi.getFullYear();

        const venditeMese = vendite.filter(v => {
            if (!v.data) return false;
            const [day, month, year] = v.data.split('/');
            const vDate = new Date(`${year}-${month}-${day}`);
            return vDate.getMonth() === meseCorrente && vDate.getFullYear() === annoCorrente;
        });

        const venditeOggi = venditeMese.filter(v => new Date(v.data.split('/').reverse().join('-')).getDate() === oggi.getDate());

        const calcStats = (data) => data.reduce((acc, v) => {
            const importo = v.importo || 0;
            acc.totale += importo;
            acc.count += 1;
            return acc;
        }, { totale: 0, count: 0 });

        return { oggi: calcStats(venditeOggi), mese: calcStats(venditeMese) };
    }, [vendite]);
    
    const recentActivities = React.useMemo(() => {
        const allActivities = [
            ...vendite.map(v => ({...v, type: 'Vendita', date: new Date(v.data.split('/').reverse().join('-'))})),
            ...riparazioni.map(r => ({...r, type: 'Riparazione', date: new Date(r.data.split('/').reverse().join('-'))}))
        ];
        return allActivities.sort((a, b) => b.date - a.date).slice(0, 5);
    }, [vendite, riparazioni]);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                <p className="text-gray-600 mt-1">Riepilogo dell'attività odierna e mensile.</p>
            </div>

            {/* Riepilogo Giornaliero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <StatCard title="Obiettivo del Giorno" className="border-blue-500">
                    <p><strong>TGT Fatturato:</strong> <span className="font-bold text-lg">{obiettivi.budget}</span></p>
                    <p><strong>TGT WO:</strong> <span className="font-bold text-lg">{obiettivi.wo}{obiettivi.wo !== 'N/D' && ' €'}</span></p>
                </StatCard>
                 <StatCard title="Fatturato WO (Oggi)" className="border-green-500">
                    <p className="text-3xl font-light text-green-700">{stats.oggi.totale.toFixed(2)} €</p>
                    <p className="text-gray-500">da {stats.oggi.count} vendite</p>
                </StatCard>
                 <StatCard title="Fatturato WO (Mese)" className="border-teal-500">
                     <p className="text-3xl font-light text-teal-700">{stats.mese.totale.toFixed(2)} €</p>
                     <p className="text-gray-500">da {stats.mese.count} vendite</p>
                </StatCard>
            </div>

            {/* Azioni Rapide e Attività Recenti */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Azioni Rapide</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => onNavigate('laboratorio', 'carica')} icon={PlusCircle} variant="success">Carica Vendita</Button>
                        <Button onClick={() => onNavigate('laboratorio', 'caricaRiparazione')} icon={PlusCircle} variant="teal">Carica Riparazione</Button>
                        <Button onClick={() => onNavigate('contattologia', 'nuova_vendita_lac')} icon={Contact} variant="indigo">Vendita LAC</Button>
                        <Button onClick={() => onNavigate('contattologia', 'nuova_prova_lac')} icon={Beaker} variant="sky">Prova LAC</Button>
                        <Button onClick={() => onNavigate('laboratorio', 'ricerca')} icon={Search} className="col-span-2">Ricerca Globale</Button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Attività Recenti</h3>
                    <ul className="space-y-3">
                        {recentActivities.map(act => (
                            <li key={act.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-md">
                                <div className="flex items-center gap-3">
                                   <span className={`px-2 py-1 text-xs rounded-full text-white ${act.type === 'Vendita' ? 'bg-blue-500' : 'bg-sky-500'}`}>{act.type}</span>
                                   <span><strong>{act.cliente}</strong> - {act.data}</span>
                                </div>
                                <span className="font-semibold text-gray-600">
                                    {act.type === 'Vendita' ? act.stato_ordine : act.stato}
                                </span>
                            </li>
                        ))}
                         {recentActivities.length === 0 && <p className="text-gray-500 text-center">Nessuna attività recente.</p>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// ===================================================================================
// --- COMPONENTI MODALI (DEFINIZIONI COMPLETE) ---
// ===================================================================================

const MultiStatusModal = ({ isOpen, onClose, vendite }) => {
    const [vaschetteInput, setVaschetteInput] = React.useState('');
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleMultiUpdate = async () => {
        const vaschetteList = vaschetteInput.match(/\d{3}/g) || [];
        if (vaschetteList.length === 0) {
            toast.error('Nessun numero di vaschetta (3 cifre) valido trovato.');
            return;
        }

        setIsUpdating(true);
        const batch = writeBatch(db);
        const updatedOrders = [];
        const notFoundVaschette = new Set(vaschetteList);

        for (const vaschetta of vaschetteList) {
            const ordine = vendite.find(v => v.rif_vaschetta === vaschetta && v.stato_ordine !== 'CONSEGNATO');
            if (ordine) {
                const docRef = getDocumentRef('vendite', ordine.id);
                batch.update(docRef, { stato_ordine: 'PRONTO' });
                updatedOrders.push(ordine.rif_vaschetta);
                notFoundVaschette.delete(vaschetta);
            }
        }

        try {
            await batch.commit();
            let successMessage = `${updatedOrders.length} ordini aggiornati a "PRONTO".`;
            toast.success(successMessage, { duration: 4000 });

            if (notFoundVaschette.size > 0) {
                let errorMessage = `${notFoundVaschette.size} vaschette non trovate o già consegnate: ${Array.from(notFoundVaschette).join(', ')}`;
                toast.error(errorMessage, { duration: 6000 });
            }
            setVaschetteInput('');
            onClose();
        } catch (error) {
            console.error("Errore nell'aggiornamento multiplo:", error);
            toast.error(`Impossibile completare l'operazione: ${error.message}`);
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleVaschetteInputChange = (e) => {
        let value = e.target.value;
        value = value.replace(/^(\d{3})[a-zA-Z]/gm, '$1\n');
        const lines = value.split('\n');
        const processedLines = lines.map(line => {
            const digitsOnly = line.replace(/\D/g, '');
            return digitsOnly.substring(0, 3);
        });
        setVaschetteInput(processedLines.join('\n'));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifica Multipla Stato in PRONTO" size="max-w-md">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Inserisci i numeri di vaschetta. Dopo 3 cifre, una lettera provocherà un "a capo". Un numero o un simbolo verrà ignorato.
                </p>
                <TextArea
                    rows="8"
                    placeholder={"101\n102\n103"}
                    value={vaschetteInput}
                    onChange={handleVaschetteInputChange}
                    disabled={isUpdating}
                />
                <div className="grid grid-cols-3 gap-3 pt-4">
                    <Button onClick={() => setVaschetteInput('')} variant="warning" icon={Trash2} disabled={isUpdating}>
                        Pulisci
                    </Button>
                    <Button onClick={onClose} variant="neutral" disabled={isUpdating}>
                        Annulla
                    </Button>
                    <Button onClick={handleMultiUpdate} variant="success" icon={CopyCheck} isLoading={isUpdating}>
                        Aggiorna
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const DettagliVenditaModal = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item) return null;

    const isVendita = item.resultType === 'vendita';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Dettagli ${isVendita ? 'Vendita' : 'Riparazione'}`} size="max-w-2xl">
            <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-md">
                    <h4 className="font-semibold">Informazioni Principali</h4>
                    <p><strong>Cliente:</strong> {item.cliente}</p>
                    <p><strong>Data:</strong> {item.data}</p>
                    {item.rif_vaschetta && <p><strong>Rif. Vaschetta:</strong> {item.rif_vaschetta}</p>}
                </div>
                {isVendita ? (
                    <>
                        <div className="p-3 bg-gray-50 rounded-md">
                            <h4 className="font-semibold">Dettagli Ordine</h4>
                            <p><strong>Numero Ordine:</strong> {item.numero_ordine}</p>
                            <p><strong>Venditore:</strong> {item.venditore}</p>
                            <p><strong>Importo:</strong> {item.importo?.toFixed(2) || '0.00'} €</p>
                            <p><strong>Stato Ordine:</strong> {item.stato_ordine}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-md">
                            <h4 className="font-semibold">Dettagli Lente</h4>
                             <p><strong>Tipo Lente:</strong> {item.tipo_lente}</p>
                             <p><strong>Ordine Lente:</strong> {item.ordine_lente}</p>
                             <p><strong>Trattamenti:</strong> {item.trattamenti?.join(', ') || 'Nessuno'}</p>
                        </div>
                    </>
                ) : (
                     <div className="p-3 bg-gray-50 rounded-md">
                        <h4 className="font-semibold">Dettagli Riparazione</h4>
                        <p><strong>Descrizione:</strong> {item.descrizione}</p>
                        <p><strong>Stato:</strong> {item.stato}</p>
                        {item.importo !== undefined && <p><strong>Importo:</strong> {item.importo?.toFixed(2)} €</p>}
                        <p><strong>In Garanzia:</strong> {item.in_garanzia ? 'Sì' : 'No'}</p>
                        <h5 className="font-semibold mt-2">Note:</h5>
                        <div className="mt-1 p-2 bg-white border rounded-md max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
                            {item.note || 'Nessuna nota presente.'}
                        </div>
                    </div>
                )}
            </div>
             <div className="flex justify-end mt-6">
                <Button onClick={onClose} variant="neutral">Chiudi</Button>
            </div>
        </Modal>
    );
};

// ===================================================================================
// --- SEZIONE LABORATORIO ---
// ===================================================================================

const Laboratorio = ({ vendite, venditori, riparazioni, contatti, initialSubView = 'ricerca' }) => {
    const [subView, setSubView] = React.useState(initialSubView);
    const [consegnaRapida, setConsegnaRapida] = React.useState('');
    const [isMultiStatusModalOpen, setIsMultiStatusModalOpen] = React.useState(false);
    
    // State per le modali
    const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false);
    const [selectedVendita, setSelectedVendita] = React.useState(null);
    const [isEditRiparazioneModalOpen, setIsEditRiparazioneModalOpen] = React.useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = React.useState(false);
    const [selectedRiparazione, setSelectedRiparazione] = React.useState(null);
    const [isContattoModalOpen, setIsContattoModalOpen] = React.useState(false);
    const [selectedContatto, setSelectedContatto] = React.useState(null);
    const [isDettagliModalOpen, setIsDettagliModalOpen] = React.useState(false);
    const [selectedItemForDettagli, setSelectedItemForDettagli] = React.useState(null);
    
    // Gestione consegna rapida
    const handleConsegnaRapida = async (e) => {
        if (e.key === 'Enter') {
            const match = consegnaRapida.match(/^(\d{3})c$/i);
            if (!match) return;

            const vaschetta = match[1];
            setConsegnaRapida('');
            
            // Cerca prima nelle vendite
            const ordine = vendite.find(v => v.rif_vaschetta === vaschetta && v.stato_ordine !== 'CONSEGNATO');
            if (ordine) {
                const updatePromise = updateDoc(getDocumentRef('vendite', ordine.id), { stato_ordine: 'CONSEGNATO' });
                toast.promise(updatePromise, {
                    loading: 'Aggiornamento...',
                    success: `Ordine ${ordine.rif_vaschetta} (${ordine.cliente}) segnato come CONSEGNATO.`,
                    error: `Impossibile aggiornare l'ordine: ${e.message}`,
                });
                return;
            }

            // Cerca nelle riparazioni
            const riparazione = riparazioni.find(r => r.rif_vaschetta === vaschetta && r.stato !== 'CONSEGNATO');
            if (riparazione) {
                const updatePromise = updateDoc(getDocumentRef('riparazioni', riparazione.id), { stato: 'CONSEGNATO' });
                 toast.promise(updatePromise, {
                    loading: 'Aggiornamento...',
                    success: `Riparazione ${riparazione.rif_vaschetta} (${riparazione.cliente}) segnata come CONSEGNATA.`,
                    error: `Impossibile aggiornare: ${e.message}`,
                });
                return;
            }
            
            toast.error(`Nessun ordine o riparazione attiva trovata per la vaschetta ${vaschetta}.`);
        }
    };
    
    // Funzioni per aprire le modali
    const openStatusModal = (vendita) => { setSelectedVendita(vendita); setIsStatusModalOpen(true); };
    const openEditRiparazioneModal = (riparazione) => { setSelectedRiparazione(riparazione); setIsEditRiparazioneModalOpen(true); };
    const openActionModal = (riparazione) => { setSelectedRiparazione(riparazione); setIsActionModalOpen(true); };
    const openContattoModal = (contatto) => { setSelectedContatto(contatto); setIsContattoModalOpen(true); };
    const openDettagliModal = (item) => { setSelectedItemForDettagli(item); setIsDettagliModalOpen(true); };
    
    // Funzione per aggiornare lo stato di una vendita
    const handleUpdateStatus = async (newStatus) => {
        if (selectedVendita) {
            const updatePromise = updateDoc(getDocumentRef('vendite', selectedVendita.id), { stato_ordine: newStatus });
            
            toast.promise(updatePromise, {
                loading: 'Aggiornamento stato...',
                success: 'Stato aggiornato correttamente.',
                error: (err) => `Impossibile aggiornare: ${err.message}`,
            });

            setIsStatusModalOpen(false);
            setSelectedVendita(null);
        }
    };

    const handleContattoSave = () => {
        setIsContattoModalOpen(false);
        setSelectedContatto(null);
        // il toast di successo/errore è ora gestito all'interno del componente AddEditContattoModal
    };

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={() => setSubView('carica')} variant="success" icon={PlusCircle}>Carica Vendita</Button>
            <Button onClick={() => setSubView('caricaRiparazione')} variant="teal" icon={PlusCircle}>Carica Riparazione/Ordine</Button>
            <Button onClick={() => setSubView('elimina')} variant="danger" icon={Trash2} className="md:col-span-2">Elimina Vendita</Button>
        </div>
    );
    
    // --- SOTTOCOMPONENTI DEL LABORATORIO ---
    
    const RicercaGlobale = () => {
        const [searchTerm, setSearchTerm] = React.useState('');
        const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
        const [escludiConsegnati, setEscludiConsegnati] = React.useState(true);
    
        const searchResults = React.useMemo(() => {
            if (!debouncedSearchTerm) return [];
    
            const lowerCaseSearch = debouncedSearchTerm.toLowerCase();
    
            const filteredVendite = vendite.filter(v => {
                const clienteMatch = v.cliente.toLowerCase().includes(lowerCaseSearch);
                const vaschettaMatch = v.rif_vaschetta && v.rif_vaschetta.includes(lowerCaseSearch);
                const statoMatch = !escludiConsegnati || v.stato_ordine !== 'CONSEGNATO';
                return (clienteMatch || vaschettaMatch) && statoMatch;
            }).map(v => ({...v, resultType: 'vendita', sortDate: new Date(v.data.split('/').reverse().join('-')) }));
    
            const filteredRiparazioni = riparazioni.filter(r => {
                const clienteMatch = r.cliente.toLowerCase().includes(lowerCaseSearch);
                const vaschettaMatch = r.rif_vaschetta && r.rif_vaschetta.includes(lowerCaseSearch);
                const statoMatch = !escludiConsegnati || r.stato !== 'CONSEGNATO';
                return (clienteMatch || vaschettaMatch) && statoMatch;
            }).map(r => ({...r, resultType: 'riparazione', sortDate: new Date(r.data.split('/').reverse().join('-')) }));
            
            const filteredContatti = contatti.filter(c => {
                 const clienteMatch = c.cliente.toLowerCase().includes(lowerCaseSearch);
                 const vaschettaMatch = c.rif_vaschetta && c.rif_vaschetta.includes(lowerCaseSearch);
                 return clienteMatch || vaschettaMatch;
            }).map(c => ({...c, resultType: 'contatto', sortDate: c.lenti && c.lenti.length > 0 ? new Date(c.lenti[c.lenti.length-1].data_acquisto) : new Date(0) }));

            return [...filteredVendite, ...filteredRiparazioni, ...filteredContatti].sort((a, b) => b.sortDate - a.sortDate);
    
        }, [debouncedSearchTerm, escludiConsegnati, vendite, riparazioni, contatti]);
    
        const statusConfig = {
            'ORDINE IN CORSO': 'bg-blue-100 text-blue-800',
            'CONTROLLO TECNICO': 'bg-sky-100 text-sky-800',
            'PRONTO': 'bg-teal-100 text-teal-800',
            'SOSTITUZIONE IN GARANZIA': 'bg-orange-100 text-orange-800',
            'CONSEGNATO': 'bg-slate-100 text-slate-800',
            'IN ATTESA': 'bg-yellow-100 text-yellow-800',
            'IN LAVORAZIONE': 'bg-indigo-100 text-indigo-800'
        };

        const resultTypeConfig = {
            vendita: { label: 'Vendita', color: 'bg-blue-500', borderColor: 'border-blue-500' },
            riparazione: { label: 'Riparazione', color: 'bg-sky-500', borderColor: 'border-sky-500' },
            contatto: { label: 'Contatto LAC', color: 'bg-green-500', borderColor: 'border-green-500' },
        };

        return (
            <div>
                 <div className="bg-gray-50 p-4 rounded-lg space-y-4 mb-6 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Search size={24} className="text-gray-400" />
                        <Input 
                            type="text" 
                            placeholder="Cerca per cognome cliente o rif. vaschetta..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="text-lg"
                        />
                    </div>
                    <div className="flex items-center">
                       <input 
                            type="checkbox" 
                            id="escludi_consegnati"
                            checked={escludiConsegnati}
                            onChange={(e) => setEscludiConsegnati(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                       />
                       <label htmlFor="escludi_consegnati" className="text-sm font-medium text-gray-700">
                           Escludi 'CONSEGNATO' dai risultati (per vendite e riparazioni)
                       </label>
                    </div>
                </div>
                
                <div className="mt-6">
                    {debouncedSearchTerm && searchResults.length === 0 && (
                        <p className="text-center text-gray-500 mt-8">Nessun risultato trovato per "{debouncedSearchTerm}".</p>
                    )}
                    {!debouncedSearchTerm && (
                        <div className="text-center text-gray-400 mt-16">
                            <Search size={48} className="mx-auto" />
                            <p className="mt-2 text-lg">Inizia a digitare per cercare...</p>
                        </div>
                    )}
                    <ul className="space-y-4">
                        {searchResults.map(item => {
                            const config = resultTypeConfig[item.resultType];
                            let typeLabel = config.label;
                            if (item.resultType === 'contatto') {
                                typeLabel = item.tipo === 'prova' ? 'Prova LAC' : 'Vendita LAC';
                            }

                            return (
                                <li key={item.id} className={`bg-white p-4 rounded-lg shadow-md border-l-4 transition-shadow hover:shadow-lg ${config.borderColor}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${config.color}`}>{typeLabel}</span>
                                                <p className="text-lg font-bold text-gray-800">{item.cliente}</p>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {item.data && <>Data: <strong>{item.data}</strong></>}
                                                {item.rif_vaschetta && <> &bull; Vaschetta: <strong>{item.rif_vaschetta}</strong></>}
                                                {item.numero_ordine && <> &bull; N. Ordine: <strong>{item.numero_ordine}</strong></>}
                                            </p>
                                            {item.descrizione && <p className="text-sm text-gray-700 pt-1"><strong>Descrizione:</strong> {item.descrizione}</p>}
                                            {(item.stato_ordine || item.stato) && <p className="text-sm font-semibold">Stato: <span className={`px-2 py-1 text-xs rounded-md ${statusConfig[item.stato_ordine || item.stato]}`}>{item.stato_ordine || item.stato}</span></p>}
                                        </div>
                                        <div className="flex flex-shrink-0 gap-2">
                                            {item.resultType !== 'contatto' && <Button onClick={() => openDettagliModal(item)} variant="neutral" icon={Eye}>Dettagli</Button>}
                                            {item.resultType === 'vendita' && <Button onClick={() => openStatusModal(item)} variant="indigo" icon={Edit}>Mod. Stato</Button>}
                                            {item.resultType === 'riparazione' && (
                                                <>
                                                    <Button onClick={() => openEditRiparazioneModal(item)} variant="indigo" icon={Edit}>Apri</Button>
                                                    <Button onClick={() => openActionModal(item)} variant="slate" icon={Settings}>Azioni</Button>
                                                </>
                                            )}
                                            {item.resultType === 'contatto' && <Button onClick={() => openContattoModal(item)} variant="success" icon={Eye}>Dettagli</Button>}
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>
        );
    };

    const CaricaVenditaForm = () => {
        const [isSaving, setIsSaving] = React.useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSaving(true);
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            if (!data.cliente || !data.stato_ordine || !/^\d{3}$/.test(data.rif_vaschetta) || !/^\d{5}$/.test(data.numero_ordine) || !data.importo) {
                toast.error("Compilare tutti i campi obbligatori correttamente (Vaschetta 3 cifre, Ordine 5 cifre).");
                setIsSaving(false);
                return;
            }
            if (vendite.some(v => v.numero_ordine === data.numero_ordine)) {
                toast.error("Numero ordine già esistente.");
                setIsSaving(false);
                return;
            }

            const trattamenti = formData.getAll('trattamento');
            const nuovaVendita = { ...data, importo: parseFloat(data.importo), trattamenti, data: new Date().toLocaleDateString('it-IT') };

            try {
                await addDoc(getCollectionRef('vendite'), nuovaVendita);
                toast.success('Vendita salvata con successo!');
                e.target.reset();
                setSubView('ricerca');
            } catch (error) {
                console.error("Errore salvataggio vendita:", error);
                toast.error(`Impossibile salvare la vendita: ${error.message}`);
            } finally {
                setIsSaving(false);
            }
        };
        return (
            <div>
                <h3 className="text-2xl font-semibold mb-4">Carica Vendita</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label>Data</label><Input type="text" name="data" readOnly defaultValue={new Date().toLocaleDateString('it-IT')} className="bg-gray-100" /></div>
                        <div><label>Venditore</label><Select name="venditore">{venditori.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}</Select></div>
                        <div><label>Tipo Lente</label><Select name="tipo_lente"><option>Monofocale</option><option>Multifocale</option><option>Office</option></Select></div>
                        <div><label>Ordine Lente</label><Select name="ordine_lente"><option>Primo</option><option>Secondo</option></Select></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label>Cognome Cliente</label><Input type="text" name="cliente" required /></div>
                        <div>
                            <label>Stato Ordine</label>
                            <Select name="stato_ordine" required>
                                <option value="ORDINE IN CORSO">ORDINE IN CORSO</option>
                                <option value="PRONTO">PRONTO</option>
                                <option value="CONSEGNATO">CONSEGNATO</option>
                                <option disabled>──────────────</option>
                                <option value="CONTROLLO TECNICO">CONTROLLO TECNICO</option>
                                <option value="SOSTITUZIONE IN GARANZIA">SOSTITUZIONE IN GARANZIA</option>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label>Rif.Vaschetta (3 cifre)</label><Input type="text" name="rif_vaschetta" pattern="\d{3}" maxLength="3" required /></div>
                        <div><label>Numero Ordine (5 cifre)</label><Input type="text" name="numero_ordine" pattern="\d{5}" maxLength="5" required /></div>
                        <div><label>Importo (€)</label><Input type="number" name="importo" step="0.01" min="0" required /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                        <div>
                            <label className="font-semibold">Trattamenti</label>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {['Transition', 'Luce Blu', 'Sun RX', 'SOS'].map(t => (
                                    <label key={t} className="flex items-center">
                                        <input type="checkbox" name="trattamento" value={t} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2" />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="font-semibold">Garanzie</label>
                            <div className="flex flex-wrap gap-4 mt-2">
                                <label key="Utilizzo SOS" className="flex items-center">
                                    <input type="checkbox" name="trattamento" value="Utilizzo SOS" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2" />
                                    Utilizzo SOS
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button type="submit" variant="success" icon={PlusCircle} isLoading={isSaving}>Salva Vendita</Button>
                        <Button type="button" onClick={() => setSubView('ricerca')} variant="neutral" disabled={isSaving}>Annulla</Button>
                    </div>
                </form>
            </div>
        );
    };

    const CaricaRiparazioneForm = () => {
        const [inGaranzia, setInGaranzia] = React.useState(false);
        const [isSaving, setIsSaving] = React.useState(false);
    
        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSaving(true);
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
    
            if (!data.cliente || !data.descrizione) {
                toast.error("Compilare i campi 'Cognome Cliente' e 'Descrizione'.");
                setIsSaving(false);
                return;
            }
            
            const importoValue = inGaranzia ? 0 : (parseFloat(data.importo) || 0);

            const nuovoOrdine = {
                ...data,
                importo: importoValue,
                in_garanzia: inGaranzia,
                note: "",
                data: new Date().toLocaleDateString('it-IT'),
                tipo: 'riparazione'
            };
    
            try {
                await addDoc(getCollectionRef('riparazioni'), nuovoOrdine);
                toast.success('Riparazione/Ordine salvato con successo!');
                e.target.reset();
                setSubView('ricerca');
            } catch (error) {
                console.error("Errore salvataggio riparazione:", error);
                toast.error(`Impossibile salvare: ${error.message}`);
            } finally {
                setIsSaving(false);
            }
        };
    
        return (
            <div>
                <h3 className="text-2xl font-semibold mb-4">Carica Riparazione / Ordine Vario</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label>Data</label><Input type="text" name="data" readOnly defaultValue={new Date().toLocaleDateString('it-IT')} className="bg-gray-100" /></div>
                        <div><label>Cognome Cliente</label><Input type="text" name="cliente" required /></div>
                    </div>
                    <div>
                        <label>Descrizione Lavoro/Ordine</label>
                        <TextArea name="descrizione" rows="4" required placeholder="Es: Sostituzione astina occhiale XY, Ordine lenti a contatto ABC..."/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label>Stato</label>
                            <Select name="stato" required>
                                <option value="IN ATTESA">IN ATTESA</option>
                                <option value="IN LAVORAZIONE">IN LAVORAZIONE</option>
                                <option value="PRONTO">PRONTO</option>
                                <option value="CONSEGNATO">CONSEGNATO</option>
                            </Select>
                        </div>
                        <div><label>Rif. Vaschetta (Opzionale)</label><Input type="text" name="rif_vaschetta" pattern="\d{3}" maxLength="3" /></div>
                        <div>
                             <label>Importo (€) (Opzionale)</label>
                             <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    name="importo"
                                    step="0.01"
                                    min="0"
                                    key={inGaranzia ? 'garanzia' : 'no-garanzia'}
                                    placeholder={inGaranzia ? "Nulla da pagare" : "0.00"}
                                    disabled={inGaranzia}
                                    className={`flex-grow ${inGaranzia ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                />
                                <div className="flex items-center pt-1 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        id="in_garanzia"
                                        checked={inGaranzia}
                                        onChange={(e) => setInGaranzia(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                                    />
                                    <label htmlFor="in_garanzia" className="font-medium text-gray-700">In Garanzia</label>
                                </div>
                             </div>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <Button type="submit" variant="success" icon={PlusCircle} isLoading={isSaving}>Salva Ordine</Button>
                        <Button type="button" onClick={() => setSubView('ricerca')} variant="neutral" disabled={isSaving}>Annulla</Button>
                    </div>
                </form>
            </div>
        );
    };

    const EliminaVendita = () => {
        const [numOrdine, setNumOrdine] = React.useState('');
        const [ConfirmationDialog, requestConfirmation] = useConfirmation("Conferma Eliminazione");

        const handleDeleteRequest = () => {
            if (!/^\d{5}$/.test(numOrdine)) {
                toast.error("Inserisci un Numero Ordine valido (5 cifre).");
                return;
            }
            const venditaDaEliminare = vendite.find(v => v.numero_ordine === numOrdine);
            if (!venditaDaEliminare) {
                toast.error(`Nessuna vendita trovata con Numero Ordine ${numOrdine}.`);
                return;
            }

            requestConfirmation(
                `Sei SICURO di voler eliminare la vendita con N. Ordine ${numOrdine}? L'azione è irreversibile.`,
                async () => {
                    const deletePromise = deleteDoc(getDocumentRef('vendite', venditaDaEliminare.id));
                    
                    await toast.promise(deletePromise, {
                        loading: 'Eliminazione in corso...',
                        success: `Vendita ${numOrdine} eliminata.`,
                        error: (err) => `Impossibile eliminare: ${err.message}`,
                    });

                    setNumOrdine('');
                    setSubView('ricerca');
                }
            );
        };

        return (
            <div>
                <ConfirmationDialog />
                <h3 className="text-2xl font-semibold mb-4">Elimina Vendita</h3>
                <div className="flex items-end gap-4">
                    <div><label>Numero Ordine da eliminare</label><Input type="text" value={numOrdine} onChange={(e) => setNumOrdine(e.target.value)} maxLength="5" /></div>
                    <Button onClick={handleDeleteRequest} variant="danger" icon={Trash2}>Conferma Eliminazione</Button>
                </div>
                <Button onClick={() => setSubView('ricerca')} variant="neutral" className="mt-6">Torna al menu</Button>
            </div>
        );
    };

    const ModificaRiparazioneModal = ({ isOpen, onClose, riparazione }) => {
        const [descrizione, setDescrizione] = React.useState('');
        const [nuovaNota, setNuovaNota] = React.useState('');
        const [stato, setStato] = React.useState('');
        const [isSaving, setIsSaving] = React.useState(false);

        React.useEffect(() => {
            if (riparazione) {
                setDescrizione(riparazione.descrizione || '');
                setStato(riparazione.stato || 'IN ATTESA');
                setNuovaNota('');
            }
        }, [riparazione]);

        if (!isOpen || !riparazione) return null;

        const handleSaveChanges = async () => {
            setIsSaving(true);
            let updatedNotes = riparazione.note || '';
            if (nuovaNota.trim()) {
                const timestamp = new Date().toLocaleString('it-IT');
                const newNoteEntry = `\n--- ${timestamp} ---\n${nuovaNota.trim()}`;
                updatedNotes += newNoteEntry;
            }
            
            try {
                const docRef = getDocumentRef('riparazioni', riparazione.id);
                await updateDoc(docRef, {
                    descrizione: descrizione,
                    note: updatedNotes,
                    stato: stato
                });
                toast.success('Modifiche salvate con successo.');
                onClose();
            } catch (error) {
                console.error("Errore salvataggio modifiche riparazione:", error);
                toast.error(`Impossibile salvare: ${error.message}`);
            } finally {
                setIsSaving(false);
            }
        };

        return (
            <Modal isOpen={isOpen} onClose={onClose} title={`Dettaglio Riparazione: ${riparazione.cliente}`} size="max-w-2xl">
                <div className="space-y-4">
                    <div>
                        <label className="font-semibold">Stato</label>
                        <Select value={stato} onChange={(e) => setStato(e.target.value)}>
                            <option value="IN ATTESA">IN ATTESA</option>
                            <option value="IN LAVORAZIONE">IN LAVORazione</option>
                            <option value="PRONTO">PRONTO</option>
                            <option value="CONSEGNATO">CONSEGNATO</option>
                        </Select>
                    </div>
                    <div>
                        <label className="font-semibold">Descrizione (Modificabile)</label>
                        <TextArea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} rows="4"/>
                    </div>
                    <div>
                        <label className="font-semibold">Note Esistenti</label>
                        <div className="mt-1 p-2 bg-gray-50 border rounded-md max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
                            {riparazione.note || 'Nessuna nota presente.'}
                        </div>
                    </div>
                     <div>
                        <label className="font-semibold">Aggiungi Nuova Nota</label>
                        <TextArea value={nuovaNota} onChange={(e) => setNuovaNota(e.target.value)} rows="3" placeholder="Scrivi qui una nuova nota... (es. spedito, in attesa pezzo di ricambio, ecc.)"/>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button onClick={onClose} variant="neutral" disabled={isSaving}>Annulla</Button>
                        <Button onClick={handleSaveChanges} variant="success" isLoading={isSaving}>Salva Modifiche</Button>
                    </div>
                </div>
            </Modal>
        );
    };

    const RiparazioneActionModal = ({ isOpen, onClose, riparazione }) => {
        const [ConfirmationDialog, requestConfirmation] = useConfirmation("Conferma Azione");
    
        if (!isOpen || !riparazione) return null;
    
        const handleConsegna = () => {
            requestConfirmation(`Segnare la riparazione per "${riparazione.cliente}" come CONSEGNATA?`, async () => {
                const updatePromise = updateDoc(getDocumentRef('riparazioni', riparazione.id), { stato: 'CONSEGNATO' });
                await toast.promise(updatePromise, {
                    loading: 'Aggiornamento...',
                    success: 'Riparazione segnata come CONSEGNATA.',
                    error: (err) => `Errore: ${err.message}`,
                });
                onClose();
            });
        };
    
        const handleDelete = () => {
            requestConfirmation(`Sei SICURO di voler eliminare DEFINITIVAMENTE la riparazione per "${riparazione.cliente}"?`, async () => {
                const deletePromise = deleteDoc(getDocumentRef('riparazioni', riparazione.id));
                await toast.promise(deletePromise, {
                    loading: 'Eliminazione...',
                    success: 'Riparazione eliminata con successo.',
                    error: (err) => `Errore: ${err.message}`,
                });
                onClose();
            });
        };
    
        return (
            <>
                <ConfirmationDialog />
                <Modal isOpen={isOpen} onClose={onClose} title={`Azioni per Riparazione: ${riparazione.cliente}`}>
                    <div className="text-center space-y-4">
                        <p>Scegli un'azione per la riparazione del cliente <strong>{riparazione.cliente}</strong> del <strong>{riparazione.data}</strong>.</p>
                        <div className="flex justify-center gap-4 pt-4">
                            <Button onClick={handleConsegna} variant="success" icon={CheckCircle}>Segna come Consegnato</Button>
                            <Button onClick={handleDelete} variant="danger" icon={Trash2}>Elimina Definitivamente</Button>
                        </div>
                    </div>
                </Modal>
            </>
        );
    };
    
    // --- RENDER PRINCIPALE LABORATORIO ---
    
    const statusConfig = {
        'ORDINE IN CORSO': { variant: 'primary', icon: FlaskConical },
        'CONTROLLO TECNICO': { variant: 'sky', icon: Settings },
        'PRONTO': { variant: 'teal', icon: CheckCircle },
        'SOSTITUZIONE IN GARANZIA': { variant: 'warning', icon: Archive },
        'CONSEGNATO': { variant: 'slate', icon: Send }
    };

    const subViewComponents = {
        ricerca: <RicercaGlobale />,
        carica: <CaricaVenditaForm />,
        caricaRiparazione: <CaricaRiparazioneForm />,
        elimina: <EliminaVendita />,
        menu: renderMenu()
    };
    
    const renderSubView = () => {
        // Se la subView non è la ricerca, mostra un pulsante per tornare indietro
        if (subView !== 'ricerca') {
            return (
                <div>
                    <Button onClick={() => setSubView('ricerca')} variant="neutral" icon={ChevronLeft} className="mb-6">
                        Torna alla Ricerca
                    </Button>
                    {subViewComponents[subView] || <RicercaGlobale />}
                </div>
            );
        }
        // Altrimenti, mostra solo la vista (in questo caso la ricerca, che ha già il suo layout)
        return subViewComponents[subView] || <RicercaGlobale />;
    };


    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <MultiStatusModal isOpen={isMultiStatusModalOpen} onClose={() => setIsMultiStatusModalOpen(false)} vendite={vendite} />
            <ModificaRiparazioneModal 
                isOpen={isEditRiparazioneModalOpen}
                onClose={() => setIsEditRiparazioneModalOpen(false)}
                riparazione={selectedRiparazione}
            />
            <RiparazioneActionModal 
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                riparazione={selectedRiparazione}
            />
            <AddEditContattoModal isOpen={isContattoModalOpen} onClose={() => setIsContattoModalOpen(false)} contatto={selectedContatto} onSave={handleContattoSave} />
            <DettagliVenditaModal
                isOpen={isDettagliModalOpen}
                onClose={() => setIsDettagliModalOpen(false)}
                item={selectedItemForDettagli}
            />

            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div className="flex items-center gap-4">
                     <h2 className="text-3xl font-bold text-gray-800">Laboratorio</h2>
                </div>
                <div className="flex items-center gap-4">
                    {subView === 'ricerca' && 
                        <Button onClick={() => setSubView('menu')} variant="primary" icon={List}>Menu Azioni</Button>
                    }
                    <Button onClick={() => setIsMultiStatusModalOpen(true)} variant="neutral" icon={CopyCheck}>Modifica Stato Multiplo</Button>
                    <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
                        <label className="font-semibold text-blue-800">Consegna Rapida:</label>
                        <Input type="text" placeholder="Es. 123c + Invio" value={consegnaRapida} onChange={(e) => setConsegnaRapida(e.target.value)} onKeyDown={handleConsegnaRapida} className="p-2 rounded-md border-blue-200 shadow-sm" />
                    </div>
                </div>
            </div>

            {renderSubView()}

            <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title={`Modifica Stato Ordine N. ${selectedVendita?.numero_ordine}`}>
                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(statusConfig).map(([status, config]) => (
                        <Button key={status} onClick={() => handleUpdateStatus(status)} variant={config.variant} icon={config.icon}>{status}</Button>
                    ))}
                </div>
            </Modal>
        </div>
    );
};


// ===================================================================================
// --- EXPORTS ---
// ===================================================================================
export { Dashboard, MultiStatusModal, DettagliVenditaModal, Laboratorio };
