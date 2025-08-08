/* global __firebase_config, __app_id, __initial_auth_token, XLSX, jspdf */
import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
    getFirestore, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot,
    collection, query, writeBatch, getDocs, updateDoc, orderBy, limit
} from 'firebase/firestore';
import {
    LayoutDashboard, FlaskConical, Contact, Settings,
    Trash2, PlusCircle, ChevronLeft, X, Send, Calendar, Filter, Download, List, BarChartHorizontal,
    AlertTriangle, CheckCircle, Archive, Eye, Edit, CopyCheck, Search, Clock, Users, FileDown, Beaker,
    Trophy, Medal, BarChart2, DollarSign, Glasses, ShieldCheck
} from 'lucide-react';

// --- IMPORT AGGIUNTI PER I GRAFICI E LE NOTIFICHE ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import toast, { Toaster } from 'react-hot-toast'; // <-- NUOVO: LIBRERIA PER LE NOTIFICHE TOAST

// --- REGISTRAZIONE COMPONENTI CHART.JS ---
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, ChartDataLabels);

// --- NOTE SULLE DIPENDENZE ESTERNE ---
// 1. SheetJS (XLSX): <script src="..."></script>
// 2. jsPDF: <script src="..."></script>
// 3. jsPDF-AutoTable: <script src="..."></script>
// 4. Per le notifiche, è consigliabile installare 'react-hot-toast' via npm/yarn.

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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- HELPERS E HOOKS FIREBASE ---
const getCollectionRef = (collectionName) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Utente non autenticato.");
    return collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
};

const getDocumentRef = (collectionName, docId) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Utente non autenticato.");
    return doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, docId);
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

const useFirestoreCollection = (collectionName, isAuthReady, options = {}) => {
    const [data, setData] = React.useState([]);
    React.useEffect(() => {
        if (!isAuthReady || !auth.currentUser || !collectionName) {
            setData([]);
            return;
        }
        const collectionPath = `artifacts/${appId}/users/${auth.currentUser.uid}/${collectionName}`;
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
    }, [collectionName, isAuthReady, options.orderBy, options.orderDirection]);
    return data;
};

// --- COMPONENTI UI GENERICI ---
const Modal = ({ isOpen, onClose, title, children, size = 'max-w-lg', zIndex = 'z-50' }) => {
    if (!isOpen) return null;
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center ${zIndex} p-4 animate-fade-in`}>
            <div className={`bg-white rounded-lg shadow-xl p-6 w-full ${size} m-4 transform transition-transform duration-300 animate-fade-in-up`}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h4 className="text-xl font-semibold text-gray-800">{title}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors"><X size={24} /></button>
                </div>
                <div>{children}</div>
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
                    // La chiusura è gestita dal chiamante per dare tempo ai toast di apparire
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


// --- NUOVO: Componente Button aggiornato con isLoading ---
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
        sky: 'bg-sky-500 hover:bg-sky-600',
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
// --- NUOVI COMPONENTI PER STATISTICHE AVANZATE ---
// ===================================================================================

const Podio = ({ classifica, titolo, unita = '€' }) => {
    const podio = classifica.slice(0, 3);
    const altri = classifica.slice(3);
    const podioColors = ['bg-yellow-400', 'bg-slate-300', 'bg-yellow-600'];
    const podioIcons = [<Trophy size={40} className="text-yellow-600"/>, <Medal size={40} className="text-slate-500"/>, <Medal size={40} className="text-yellow-800"/>];

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-6">{titolo}</h3>
            {classifica.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
                        {podio.map(([nome, totale], index) => (
                            <div key={nome} className={`p-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 ${podioColors[index]}`}>
                                <div className="flex justify-center mb-2">{podioIcons[index]}</div>
                                <p className="text-xl font-bold">{index + 1}° Posto</p>
                                <p className="text-lg font-semibold">{nome}</p>
                                <p className="text-2xl font-black">{unita === '€' ? totale.toFixed(2) : totale} {unita}</p>
                            </div>
                        ))}
                    </div>
                    {altri.length > 0 && <ul className="space-y-2">
                        {altri.map(([nome, totale], index) => (
                            <li key={nome} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                                <span className="font-bold text-gray-600">{index + 4}°</span>
                                <span className="font-semibold">{nome}</span>
                                <span className="font-bold text-lg text-blue-600">{unita === '€' ? totale.toFixed(2) : totale} {unita}</span>
                            </li>
                        ))}
                    </ul>}
                </>
            ) : <p className="text-center text-gray-500 py-8">Nessun dato disponibile per questa classifica.</p>}
        </div>
    );
};

const VistaGraficiCompetizione = ({ vendite }) => {
    const [periodo, setPeriodo] = React.useState('mensile'); // 'giornaliero' o 'mensile'
    const [metrica, setMetrica] = React.useState('fatturato'); // 'fatturato', 'secondi', 'sos'

    const datiFiltrati = React.useMemo(() => {
        const oggi = new Date();
        if (periodo === 'giornaliero') {
            return vendite.filter(v => {
                if (!v.data) return false;
                const vDate = new Date(v.data.split('/').reverse().join('-'));
                return vDate.toDateString() === oggi.toDateString();
            });
        }
        return vendite.filter(v => {
            if (!v.data) return false;
            const vDate = new Date(v.data.split('/').reverse().join('-'));
            return vDate.getMonth() === oggi.getMonth() && vDate.getFullYear() === oggi.getFullYear();
        });
    }, [vendite, periodo]);

    const datiClassifiche = React.useMemo(() => {
        const reduceByVenditore = (callback) => {
            const result = datiFiltrati.reduce((acc, v) => {
                const venditore = v.venditore || 'N/D';
                acc[venditore] = (acc[venditore] || 0) + callback(v);
                return acc;
            }, {});
            return Object.entries(result).sort(([, a], [, b]) => b - a);
        };

        const classificaFatturato = reduceByVenditore(v => v.importo || 0);
        const classificaSecondi = reduceByVenditore(v => v.ordine_lente === 'Secondo' ? 1 : 0);
        const classificaSOS = reduceByVenditore(v => (v.trattamenti || []).includes('SOS') ? 1 : 0);
        
        return { classificaFatturato, classificaSecondi, classificaSOS };
    }, [datiFiltrati]);

    const renderPodio = () => {
        switch (metrica) {
            case 'fatturato': return <Podio classifica={datiClassifiche.classificaFatturato} titolo="🏆 Classifica Fatturato 🏆" unita="€" />;
            case 'secondi': return <Podio classifica={datiClassifiche.classificaSecondi} titolo="👓 Classifica Secondi Occhiali 👓" unita=" venduti" />;
            case 'sos': return <Podio classifica={datiClassifiche.classificaSOS} titolo="🛡️ Classifica Garanzie SOS 🛡️" unita=" vendute" />;
            default: return null;
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-center gap-4 flex-wrap">
                <h3 className="font-semibold text-gray-700">Periodo:</h3>
                <Button onClick={() => setPeriodo('giornaliero')} variant={periodo === 'giornaliero' ? 'primary' : 'neutral'}>Giornaliero</Button>
                <Button onClick={() => setPeriodo('mensile')} variant={periodo === 'mensile' ? 'primary' : 'neutral'}>Mese Corrente</Button>
                <div className="w-px bg-gray-300 h-8 mx-2"></div>
                <h3 className="font-semibold text-gray-700">Competizione:</h3>
                <Button onClick={() => setMetrica('fatturato')} icon={DollarSign} variant={metrica === 'fatturato' ? 'success' : 'neutral'}>Fatturato</Button>
                <Button onClick={() => setMetrica('secondi')} icon={Glasses} variant={metrica === 'secondi' ? 'success' : 'neutral'}>Secondi Occhiali</Button>
                <Button onClick={() => setMetrica('sos')} icon={ShieldCheck} variant={metrica === 'sos' ? 'success' : 'neutral'}>Garanzie SOS</Button>
            </div>
            {renderPodio()}
        </div>
    );
};

const StatisticheAvanzate = ({ vendite, venditori }) => {
    const [view, setView] = React.useState('competizione'); // competizione, analisi, testo

    return (
        <div>
            <div className="flex justify-between items-center mb-4 border-b">
                <TabButton tabName="competizione" label="Competizione Venditori" activeTab={view} setActiveTab={setView} />
                <TabButton tabName="analisi" label="Analisi Dettagliata" activeTab={view} setActiveTab={setView} />
                <TabButton tabName="testo" label="Dati Testuali" activeTab={view} setActiveTab={setView} />
            </div>
            <div className="mt-6">
                {view === 'competizione' && <VistaGraficiCompetizione vendite={vendite} />}
                {view === 'analisi' && <AnalisiVisiva vendite={vendite} venditori={venditori} />}
                {view === 'testo' && <StatisticheVendite vendite={vendite} />}
            </div>
        </div>
    );
};

const StatisticheVendite = ({ vendite }) => {
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
            acc.venditori[v.venditore] = (acc.venditori[v.venditore] || 0) + importo;
            if (v.ordine_lente === 'Primo') acc.primiOrdini++; else acc.secondiOrdini++;
            acc.tipiLente[v.tipo_lente] = (acc.tipiLente[v.tipo_lente] || 0) + 1;
            return acc;
        }, { totale: 0, venditori: {}, primiOrdini: 0, secondiOrdini: 0, tipiLente: { Monofocale: 0, Multifocale: 0, Office: 0 } });

        return { oggi: calcStats(venditeOggi), mese: calcStats(venditeMese), nomeMese: oggi.toLocaleString('it-IT', { month: 'long' }) };
    }, [vendite]);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Totali Generali" className="border-blue-500"><p><strong>Oggi:</strong> {stats.oggi.totale.toFixed(2)} €</p><p><strong>Mese ({stats.nomeMese}):</strong> {stats.mese.totale.toFixed(2)} €</p></StatCard>
                <StatCard title="Vendite per Venditore (Oggi)" className="border-green-500">{Object.entries(stats.oggi.venditori).map(([nome, tot]) => <p key={nome}><strong>{nome}:</strong> {tot.toFixed(2)} €</p>)}</StatCard>
                <StatCard title="Vendite per Venditore (Mese)" className="border-teal-500">{Object.entries(stats.mese.venditori).map(([nome, tot]) => <p key={nome}><strong>{nome}:</strong> {tot.toFixed(2)} €</p>)}</StatCard>
                <StatCard title="Tipo Ordine Lente" className="border-indigo-500"><p><strong>Oggi:</strong> {stats.oggi.primiOrdini} Primi / {stats.oggi.secondiOrdini} Secondi</p><p><strong>Mese:</strong> {stats.mese.primiOrdini} Primi / {stats.mese.secondiOrdini} Secondi</p></StatCard>
                <StatCard title="Tipo Lenti Vendute (Oggi)" className="border-sky-500">{Object.entries(stats.oggi.tipiLente).map(([tipo, qta]) => <p key={tipo}><strong>{tipo}:</strong> {qta}</p>)}</StatCard>
                <StatCard title="Tipo Lenti Vendute (Mese)" className="border-orange-500">{Object.entries(stats.mese.tipiLente).map(([tipo, qta]) => <p key={tipo}><strong>{tipo}:</strong> {qta}</p>)}</StatCard>
            </div>
        </div>
    );
};

const AnalisiVisiva = ({ vendite, venditori }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

    const [filtri, setFiltri] = React.useState({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        venditore: 'tutti',
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFiltri(prev => ({ ...prev, [name]: value }));
    };

    const datiFiltrati = React.useMemo(() => {
        const startDate = new Date(filtri.startDate);
        const endDate = new Date(filtri.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the whole end day

        return vendite.filter(v => {
            if (!v.data) return false;
            const vDate = new Date(v.data.split('/').reverse().join('-'));
            
            const dateMatch = vDate >= startDate && vDate <= endDate;
            const venditoreMatch = filtri.venditore === 'tutti' || v.venditore === filtri.venditore;

            return dateMatch && venditoreMatch;
        });
    }, [vendite, filtri]);

    const stats = React.useMemo(() => {
        if (datiFiltrati.length === 0) {
            return { totale: 0, count: 0, media: 0, primi: 0, secondi: 0, trattamenti: [] };
        }

        const totale = datiFiltrati.reduce((acc, v) => acc + (v.importo || 0), 0);
        const count = datiFiltrati.length;
        const media = count > 0 ? totale / count : 0;

        const { primi, secondi } = datiFiltrati.reduce((acc, v) => {
            if (v.ordine_lente === 'Secondo') acc.secondi++;
            else acc.primi++;
            return acc;
        }, { primi: 0, secondi: 0 });

        const conteggioTrattamenti = datiFiltrati.reduce((acc, v) => {
            (v.trattamenti || []).forEach(t => {
                acc[t] = (acc[t] || 0) + 1;
            });
            return acc;
        }, {});
        const trattamenti = Object.entries(conteggioTrattamenti).sort(([, a], [, b]) => b - a);

        return { totale, count, media, primi, secondi, trattamenti };
    }, [datiFiltrati]);

    const doughnutData = {
        labels: ['Primo Occhiale', 'Secondo Occhiale'],
        datasets: [{
            data: [stats.primi, stats.secondi],
            backgroundColor: ['#3b82f6', '#10b981'],
            borderColor: '#ffffff',
            borderWidth: 2,
        }]
    };

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Rapporto Primo vs Secondo Occhiale', font: { size: 16 } },
            datalabels: {
                formatter: (value, ctx) => {
                    const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                    return `${value}\n(${percentage})`;
                },
                color: '#fff',
                textAlign: 'center',
                font: { weight: 'bold', size: 14 }
            }
        }
    };

    const trattamentiData = {
        labels: stats.trattamenti.map(([nome]) => nome),
        datasets: [{
            label: 'Numero di Vendite',
            data: stats.trattamenti.map(([, conteggio]) => conteggio),
            backgroundColor: '#8b5cf6',
        }]
    };

    const trattamentiOptions = {
        indexAxis: 'y',
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Popolarità Trattamenti e Garanzie', font: { size: 16 } },
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Filtra Dati</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm font-medium">Data Inizio</label>
                        <Input type="date" name="startDate" value={filtri.startDate} onChange={handleFilterChange} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Data Fine</label>
                        <Input type="date" name="endDate" value={filtri.endDate} onChange={handleFilterChange} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Venditore</label>
                        <Select name="venditore" value={filtri.venditore} onChange={handleFilterChange}>
                            <option value="tutti">Tutti i venditori</option>
                            {venditori.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                        </Select>
                    </div>
                </div>
            </div>

            {datiFiltrati.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Fatturato Totale</p>
                            <p className="text-3xl font-bold text-green-600">{stats.totale.toFixed(2)} €</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Numero Vendite</p>
                            <p className="text-3xl font-bold text-blue-600">{stats.count}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Valore Medio Vendita</p>
                            <p className="text-3xl font-bold text-indigo-600">{stats.media.toFixed(2)} €</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <Doughnut data={doughnutData} options={doughnutOptions} />
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <Bar data={trattamentiData} options={trattamentiOptions} />
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <p className="text-gray-500">Nessuna vendita trovata per i filtri selezionati.</p>
                </div>
            )}
        </div>
    );
};


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

const InviaDatiCassettoModal = ({ isOpen, onClose, vendite, emailAmministrazioni }) => {
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [selectedEmails, setSelectedEmails] = React.useState([]);
    // Usiamo AlertModal solo per la validazione, che è un caso d'uso appropriato per un modale bloccante
    const [alertState, setAlertState] = React.useState({ isOpen: false, title: '', message: '' });

    const calculatedData = React.useMemo(() => {
        const inCorso = { totale: 0, count: 0 };
        const pronti = { totale: 0, count: 0 };

        const targetDate = new Date(selectedDate);
        targetDate.setHours(23, 59, 59, 999);

        vendite.forEach(v => {
            if (!v.data || !v.data.includes('/')) return;
            const vDate = new Date(v.data.split('/').reverse().join('-'));

            if (vDate <= targetDate) {
                const importo = v.importo || 0;
                if (v.stato_ordine === 'ORDINE IN CORSO') {
                    inCorso.totale += importo;
                    inCorso.count += 1;
                } else if (v.stato_ordine === 'PRONTO') {
                    pronti.totale += importo;
                    pronti.count += 1;
                }
            }
        });

        return { inCorso, pronti };
    }, [selectedDate, vendite]);
    
    const handleSendEmail = () => {
        if (selectedEmails.length === 0) {
            setAlertState({ isOpen: true, title: "Attenzione", message: "Seleziona almeno un destinatario." });
            return;
        }

        let body = `Riepilogo dati per cassetto fiscale fino al ${new Date(selectedDate).toLocaleDateString('it-IT')}:\n\n`;
        body += `ORDINI IN CORSO:\n`;
        body += `  - Totale Valore: ${calculatedData.inCorso.totale.toFixed(2)} €\n`;
        body += `  - Numero Schede: ${calculatedData.inCorso.count}\n\n`;
        body += `ORDINI PRONTI:\n`;
        body += `  - Totale Valore: ${calculatedData.pronti.totale.toFixed(2)} €\n`;
        body += `  - Numero Schede: ${calculatedData.pronti.count}\n\n`;
        body += `Cordiali Saluti,\nIl Sistema Gestionale`;

        const mailtoLink = `mailto:${selectedEmails.join(',')}?subject=Riepilogo Dati Cassetto Fiscale&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
        toast.success("Email pronta nel client di posta!");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dati per Cassetto Fiscale" size="max-w-3xl">
            <AlertModal {...alertState} onClose={() => setAlertState({ ...alertState, isOpen: false })} />
            <div className="space-y-6">
                 <div>
                    <label className="font-semibold text-gray-700">Seleziona Destinatari</label>
                    <div className="p-2 border rounded-md mt-2 max-h-32 overflow-y-auto bg-gray-50">
                        {emailAmministrazioni.map(e => (
                            <label key={e.id} className="flex items-center p-1">
                                <input type="checkbox" value={e.email} onChange={(evt) => {
                                    if (evt.target.checked) setSelectedEmails([...selectedEmails, e.email]);
                                    else setSelectedEmails(selectedEmails.filter(em => em !== e.email));
                                }} className="mr-2" />
                                {e.nomeContatto} ({e.email})
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="font-semibold text-gray-700">Calcola totali fino alla data</label>
                    <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-lg text-blue-800 mb-2">Ordini in Corso</h4>
                        <p className="text-2xl font-light">{calculatedData.inCorso.totale.toFixed(2)} €</p>
                        <p className="text-sm text-gray-600">Basato su <span className="font-semibold">{calculatedData.inCorso.count}</span> schede</p>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                        <h4 className="font-bold text-lg text-teal-800 mb-2">Ordini Pronti</h4>
                        <p className="text-2xl font-light">{calculatedData.pronti.totale.toFixed(2)} €</p>
                        <p className="text-sm text-gray-600">Basato su <span className="font-semibold">{calculatedData.pronti.count}</span> schede</p>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button type="button" onClick={onClose} variant="neutral">Chiudi</Button>
                    <Button type="button" icon={Send} onClick={handleSendEmail} disabled={selectedEmails.length === 0}>Prepara Email</Button>
                </div>
            </div>
        </Modal>
    );
};


const GestioneDatiModal = ({ isOpen, onClose, vendite, venditori, emailAmministrazioni }) => {
    const [activeTab, setActiveTab] = React.useState('dati');
    const [ConfirmationDialog, requestConfirmation] = useConfirmation();
    
    // State per nuovi elementi
    const [nuovoVenditore, setNuovoVenditore] = React.useState('');
    const [nuovaEmailNome, setNuovaEmailNome] = React.useState('');
    const [nuovaEmailAddr, setNuovaEmailAddr] = React.useState('');
    const [archiveMonths, setArchiveMonths] = React.useState(6);

    // State per i caricamenti
    const [isAddingVenditore, setIsAddingVenditore] = React.useState(false);
    const [isAddingEmail, setIsAddingEmail] = React.useState(false);
    const [isArchiving, setIsArchiving] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);


    const handleExport = () => {
        requestConfirmation("Vuoi esportare tutti i dati in un file JSON?", async () => {
            const collectionsToExport = ['vendite', 'venditori', 'emailAmministrazioni', 'datiMensili', 'riparazioni', 'contatti_lenti'];
            const backupData = {};
            const exportPromise = new Promise(async (resolve, reject) => {
                 try {
                    for (const coll of collectionsToExport) {
                        const snapshot = await getDocs(getCollectionRef(coll));
                        backupData[coll] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    }
                    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `backup_gestionale_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    resolve("Backup esportato con successo!");
                } catch (err) {
                    console.error(err);
                    reject(`Errore durante l'esportazione: ${err.message}`);
                }
            });

            toast.promise(exportPromise, {
                loading: 'Esportazione in corso...',
                success: (msg) => msg,
                error: (err) => err,
            });
        });
    };
    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        requestConfirmation("ATTENZIONE: L'importazione sovrascriverà TUTTI i dati esistenti. Questa azione è irreversibile. Continuare?", () => {
            setIsImporting(true);
            const reader = new FileReader();
            reader.onload = async (event) => {
                const importPromise = new Promise(async (resolve, reject) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        const batch = writeBatch(db);
                        
                        const collectionsInApp = ['vendite', 'venditori', 'emailAmministrazioni', 'datiMensili', 'riparazioni', 'contatti_lenti'];
                        for (const collName of collectionsInApp) {
                            const oldDocsSnapshot = await getDocs(getCollectionRef(collName));
                            oldDocsSnapshot.forEach(doc => batch.delete(doc.ref));
                        }
                        await batch.commit();

                        const newBatch = writeBatch(db);
                        for (const collName in data) {
                            if (collectionsInApp.includes(collName)) {
                                data[collName].forEach(item => {
                                    const { id, ...itemData } = item;
                                    const docRef = getDocumentRef(collName, id);
                                    newBatch.set(docRef, itemData);
                                });
                            }
                        }
                        await newBatch.commit();
                        resolve("Dati importati con successo! La pagina si ricaricherà.");
                        setTimeout(() => window.location.reload(), 2000);
                    } catch (err) {
                        console.error(err);
                        reject(`Errore durante l'importazione: ${err.message}`);
                    }
                });
                
                toast.promise(importPromise, {
                    loading: 'Importazione dati in corso...',
                    success: (msg) => msg,
                    error: (err) => err,
                }).finally(() => setIsImporting(false));
            };
            reader.readAsText(file);
        });
        e.target.value = null;
    };
    
    const handleArchive = (automatic = false) => {
        let venditeDaArchiviare;
        let confirmationMessage;

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - archiveMonths);
        
        venditeDaArchiviare = vendite.filter(v => {
            const isConsegnato = v.stato_ordine === 'CONSEGNATO';
            if (!isConsegnato) return false;
            if (automatic) {
                return new Date(v.data.split('/').reverse().join('-')) < cutoffDate;
            }
            return true;
        });

        if (automatic) {
            confirmationMessage = `Trovati ${venditeDaArchiviare.length} ordini 'CONSEGNATI' più vecchi di ${archiveMonths} mesi. Procedere?`;
        } else {
            confirmationMessage = `Trovati ${venditeDaArchiviare.length} ordini 'CONSEGNATI'. Procedere?`;
        }

        if (venditeDaArchiviare.length === 0) {
            toast.error("Nessun ordine 'CONSEGNATO' trovato per i criteri selezionati.");
            return;
        }

        requestConfirmation(confirmationMessage, async () => {
            setIsArchiving(true);
            const archivePromise = new Promise(async (resolve, reject) => {
                try {
                    if (!window.jspdf || !window.jspdf.jsPDF) {
                        reject("La libreria per la generazione di PDF (jsPDF) non è disponibile."); return;
                    }
                    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
                    doc.text(`Archivio Ordini Consegnati al ${new Date().toLocaleDateString('it-IT')}`, 14, 16);
                    const body = venditeDaArchiviare.map(v => [v.data, v.cliente, v.venditore, v.numero_ordine, v.rif_vaschetta, v.tipo_lente, v.ordine_lente, (v.importo || 0).toFixed(2)]);
                    doc.autoTable({
                        head: [['Data', 'Cliente', 'Venditore', 'N. Ordine', 'Rif.Vaschetta', 'Tipo Lente', 'Ordine Lente', 'Importo (€)']],
                        body: body, startY: 20, theme: 'striped', styles: { fontSize: 8 }
                    });
                    doc.save(`Archivio_Consegnati_${new Date().toISOString().slice(0, 10)}.pdf`);
                    const batch = writeBatch(db);
                    venditeDaArchiviare.forEach(v => batch.delete(getDocumentRef('vendite', v.id)));
                    await batch.commit();
                    resolve(`${venditeDaArchiviare.length} ordini archiviati e rimossi.`);
                } catch (err) {
                    console.error(err);
                    reject(`Errore durante l'archiviazione: ${err.message}`);
                }
            });

            toast.promise(archivePromise, {
                loading: 'Archiviazione in corso...',
                success: (msg) => msg,
                error: (err) => err,
            }).finally(() => setIsArchiving(false));
        });
    };

    const handleAggiungiVenditore = async () => {
        if (nuovoVenditore.trim() === '') { toast.error("Il nome del venditore non può essere vuoto."); return; }
        if (venditori.some(v => v.nome.toLowerCase() === nuovoVenditore.trim().toLowerCase())) { toast.error("Questo venditore esiste già."); return; }
        
        setIsAddingVenditore(true);
        try {
            await addDoc(getCollectionRef('venditori'), { nome: nuovoVenditore.trim() });
            setNuovoVenditore('');
            toast.success("Venditore aggiunto.");
        } catch (error) {
            toast.error(`Impossibile aggiungere il venditore: ${error.message}`);
        } finally {
            setIsAddingVenditore(false);
        }
    };
    const handleAggiungiEmail = async () => {
        if (nuovaEmailNome.trim() === '' || nuovaEmailAddr.trim() === '') { toast.error("Compilare entrambi i campi email."); return; }
        if (!/^\S+@\S+\.\S+$/.test(nuovaEmailAddr)) { toast.error("Indirizzo email non valido."); return; }
        
        setIsAddingEmail(true);
        try {
            await addDoc(getCollectionRef('emailAmministrazioni'), { nomeContatto: nuovaEmailNome.trim(), email: nuovaEmailAddr.trim() });
            setNuovaEmailNome('');
            setNuovaEmailAddr('');
            toast.success("Email aggiunta.");
        } catch (error) {
            toast.error(`Impossibile aggiungere l'email: ${error.message}`);
        } finally {
            setIsAddingEmail(false);
        }
    };
    const requestDeleteElenco = (type, item) => {
        const message = type === 'venditore'
            ? `Sei sicuro di voler eliminare il venditore "${item.nome}"?`
            : `Sei sicuro di voler eliminare il contatto "${item.nomeContatto}" (${item.email})?`;
        
        requestConfirmation(message, async () => {
            const collectionName = type === 'venditore' ? 'venditori' : 'emailAmministrazioni';
            const deletePromise = deleteDoc(getDocumentRef(collectionName, item.id));
            
            toast.promise(deletePromise, {
                loading: 'Eliminazione...',
                success: 'Elemento eliminato.',
                error: (err) => `Impossibile eliminare: ${err.message}`,
            });
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Impostazioni" size="max-w-4xl">
            <ConfirmationDialog />
            
            <div className="flex border-b mb-6">
                <TabButton tabName="dati" label="Gestione Dati" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton tabName="elenchi" label="Gestione Elenchi" activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {activeTab === 'dati' && (
                <div>
                    <h3 className="text-2xl font-semibold mb-4">Backup e Archiviazione</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-bold mb-2">Esporta Dati</h4>
                                <p className="text-sm mb-4">Crea un backup di tutti i dati in un file JSON.</p>
                                <Button onClick={handleExport} icon={Download}>Esporta Backup</Button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-bold mb-2">Importa Dati</h4>
                                <p className="text-sm mb-4">Ripristina i dati da un file di backup.</p>
                                <Input type="file" accept=".json" onChange={handleImport} disabled={isImporting} />
                            </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <h4 className="font-bold mb-2 text-green-800">Archivia Ordini Consegnati</h4>
                            <p className="text-sm mb-4">Sposta gli ordini "CONSEGNATO" in un PDF e li rimuove dal sistema.</p>
                             <div className="flex items-end gap-4 flex-wrap">
                                <Button onClick={() => handleArchive(false)} variant="success" icon={Archive} isLoading={isArchiving}>Archivia TUTTI i Consegnati</Button>
                                <div className="flex items-end gap-2">
                                     <div>
                                        <label className="text-xs font-semibold">Mesi di anzianità</label>
                                        <Input type="number" value={archiveMonths} onChange={e => setArchiveMonths(e.target.value)} min="1" className="w-24"/>
                                     </div>
                                     <Button onClick={() => handleArchive(true)} variant="warning" icon={Clock} isLoading={isArchiving}>Archivia i più vecchi</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'elenchi' && (
                <div>
                    <h3 className="text-2xl font-semibold mb-4">Venditori ed Email</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="text-xl font-semibold mb-4">Elenco Venditori</h4>
                            <div className="flex gap-2 mb-4">
                                <Input type="text" value={nuovoVenditore} onChange={e => setNuovoVenditore(e.target.value)} placeholder="Nome venditore" />
                                <Button onClick={handleAggiungiVenditore} icon={PlusCircle} isLoading={isAddingVenditore}>Aggiungi</Button>
                            </div>
                            <ul className="space-y-2 max-h-60 overflow-y-auto">{venditori.sort((a, b) => a.nome.localeCompare(b.nome)).map(v => (<li key={v.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm"><span>{v.nome}</span><button onClick={() => requestDeleteElenco('venditore', v)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button></li>))}</ul>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="text-xl font-semibold mb-4">Elenco Email Amministrazioni</h4>
                            <div className="space-y-2 mb-4">
                                <Input type="text" value={nuovaEmailNome} onChange={e => setNuovaEmailNome(e.target.value)} placeholder="Nome contatto/ufficio" />
                                <Input type="email" value={nuovaEmailAddr} onChange={e => setNuovaEmailAddr(e.target.value)} placeholder="Indirizzo email" />
                            </div>
                            <Button onClick={handleAggiungiEmail} icon={PlusCircle} className="w-full" isLoading={isAddingEmail}>Aggiungi Email</Button>
                            <ul className="space-y-2 mt-4 max-h-60 overflow-y-auto">{emailAmministrazioni.sort((a, b) => a.nomeContatto.localeCompare(b.nomeContatto)).map(e => (<li key={e.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm"><div><p className="font-semibold">{e.nomeContatto}</p><p className="text-sm text-gray-600">{e.email}</p></div><button onClick={() => requestDeleteElenco('email', e)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button></li>))}</ul>
                        </div>
                    </div>
                </div>
            )}
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
            <Button onClick={() => setSubView('ricerca')} variant="primary" icon={Search}>Ricerca Globale</Button>
            <Button onClick={() => setSubView('carica')} variant="success" icon={PlusCircle}>Carica Vendita</Button>
            <Button onClick={() => setSubView('caricaRiparazione')} variant="success" icon={PlusCircle}>Carica Riparazione/Ordine</Button>
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
    
    const renderSubView = () => subViewComponents[subView] || <RicercaGlobale />;

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
                    {subView !== 'ricerca' && (
                        <Button onClick={() => setSubView('ricerca')} variant="neutral" icon={ChevronLeft}>Torna alla Ricerca</Button>
                    )}
                    <h2 className="text-3xl font-bold text-gray-800">Laboratorio</h2>
                </div>
                <div className="flex items-center gap-4">
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
// --- SEZIONE AMMINISTRAZIONE ---
// ===================================================================================
const Amministrazione = ({ venditori, emailAmministrazioni, vendite, datiMensiliRaw }) => { // <-- NOVITÀ: riceve datiMensiliRaw
    const [subView, setSubView] = React.useState('menu');
    const [isGestioneModalOpen, setIsGestioneModalOpen] = React.useState(false);
    const [isCassettoModalOpen, setIsCassettoModalOpen] = React.useState(false);

    // --- NOVITÀ: Logica per calcolare i dati di chiusura giornaliera ---
    const datiChiusuraGiornaliera = React.useMemo(() => {
        const oggi = new Date();
        const periodYYYYMM = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
        const datiMeseCorrente = datiMensiliRaw.find(d => d.id === periodYYYYMM);

        if (!datiMeseCorrente) {
            return { saldatoTgt: 0, saldatoCy: 0, woTgt: 0, woCy: 0 };
        }

        const oggiStr = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
        const dayIndex = datiMeseCorrente.dateHeaders.findIndex(h => h === oggiStr);

        if (dayIndex === -1) {
            return { saldatoTgt: 0, saldatoCy: 0, woTgt: 0, woCy: 0 };
        }

        const getMetricRow = (name) => datiMeseCorrente.metrics.find(m => m.name.toLowerCase() === name.toLowerCase());

        const saldatoTgtRow = getMetricRow('saldato tgt');
        const woTgtRow = getMetricRow('wo tgt');
        const saldatoCyRow = getMetricRow('saldato cy');
        const woCyRow = getMetricRow('wo cy');

        // Valori target del giorno
        const saldatoTgt = saldatoTgtRow?.values[dayIndex] || 0;
        const woTgt = woTgtRow?.values[dayIndex] || 0;

        // Calcola i totali "rolling" fino al giorno corrente (incluso)
        const calculateRollingTotal = (row) => {
            if (!row) return 0;
            return row.values.slice(0, dayIndex + 1).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        };

        const saldatoCy = calculateRollingTotal(saldatoCyRow);
        const woCy = calculateRollingTotal(woCyRow);

        return { saldatoTgt, saldatoCy, woTgt, woCy };
    }, [datiMensiliRaw]);
    // --- FINE NOVITÀ ---

    const subViewComponents = {
        datiMensili: <DatiMensili />,
        statistiche: <StatisticheAvanzate vendite={vendite} venditori={venditori} />,
        // --- NOVITÀ: passa i dati calcolati a InvioChiusura ---
        chiusura: <InvioChiusura vendite={vendite} emailAmministrazioni={emailAmministrazioni} onClose={() => setSubView('menu')} datiChiusuraGiornaliera={datiChiusuraGiornaliera} />,
        pdf: <FiltraPdf vendite={vendite} venditori={venditori} onClose={() => setSubView('menu')} />,
    };

    const renderSubView = () => subViewComponents[subView] || <p>Sezione non trovata.</p>;

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button onClick={() => setSubView('datiMensili')} variant="primary" icon={Calendar}>Dati Mensili</Button>
            <Button onClick={() => setSubView('statistiche')} variant="indigo" icon={BarChartHorizontal}>Statistiche Veloci</Button>
            <Button onClick={() => setIsCassettoModalOpen(true)} variant="sky" icon={Send}>Dati per Cassetto</Button>
            <Button onClick={() => setSubView('chiusura')} variant="success" icon={Send}>Invio Chiusura Giornaliera</Button>
            <Button onClick={() => setSubView('pdf')} variant="warning" icon={Filter}>Reportistica Avanzata</Button>
            <Button onClick={() => setIsGestioneModalOpen(true)} variant="neutral" icon={Settings}>Impostazioni</Button>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <GestioneDatiModal
                isOpen={isGestioneModalOpen}
                onClose={() => setIsGestioneModalOpen(false)}
                vendite={vendite}
                venditori={venditori}
                emailAmministrazioni={emailAmministrazioni}
            />
            <InviaDatiCassettoModal
                isOpen={isCassettoModalOpen}
                onClose={() => setIsCassettoModalOpen(false)}
                vendite={vendite}
                emailAmministrazioni={emailAmministrazioni}
            />

            <h2 className="text-3xl font-bold text-gray-800 border-b pb-4 mb-6">Amministrazione</h2>
            {subView === 'menu' ? renderMenu() : (
                <div>
                    <Button onClick={() => setSubView('menu')} variant="neutral" className="mb-6" icon={ChevronLeft}>Torna al menu Amministrazione</Button>
                    {renderSubView()}
                </div>
            )}
        </div>
    );
};

const DatiMensili = () => {
    const [datiMensili, setDatiMensili] = React.useState({});
    const [periodo, setPeriodo] = React.useState(new Date().toISOString().slice(0, 7));
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!periodo || !auth.currentUser) return;
        setIsLoading(true);
        const docRef = doc(db, `artifacts/${appId}/users/${auth.currentUser.uid}/datiMensili`, periodo);
        const unsub = onSnapshot(docRef, (doc) => {
            setDatiMensili(doc.exists() ? doc.data() : {});
            setIsLoading(false);
        }, (err) => {
            console.error("Errore onSnapshot DatiMensili:", err);
            toast.error(`Errore nel caricamento dati: ${err.message}`);
            setIsLoading(false);
        });
        return () => unsub();
    }, [periodo]);

    const handleFileProcess = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const processPromise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    if (!window.XLSX) {
                        throw new Error("La libreria per la lettura dei file Excel (XLSX) non è disponibile.");
                    }
                    const workbook = window.XLSX.read(event.target.result, { type: 'binary' });
                    // LEGGE TUTTE LE RIGHE E COLONNE, INCLUSE QUELLE VUOTE
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    // Usiamo 'range' per assicurarci di catturare tutte le celle, anche quelle vuote
                    const sheetData = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

                    let dataStartRowIndex = -1;
                    // Cerchiamo l'esatta corrispondenza per 'Saldato TGT' nella colonna D (indice 3)
                    for (let i = 0; i < sheetData.length; i++) {
                        if (sheetData[i] && String(sheetData[i][3]).trim().toLowerCase() === 'saldato tgt') {
                            dataStartRowIndex = i;
                            break;
                        }
                    }
                    if (dataStartRowIndex === -1) throw new Error('Riga "Saldato TGT" non trovata. Controllare il file Excel.');

                    const numDaysInMonth = new Date(periodo.split('-')[0], periodo.split('-')[1], 0).getDate();
                    const dateHeaders = Array.from({ length: numDaysInMonth }, (_, i) => `${String(i + 1).padStart(2, '0')}/${periodo.slice(5, 7)}/${periodo.slice(0, 4)}`);

                    const metrics = [];
                    // Leggiamo un numero sufficiente di righe per includere tutti i dati
                    const rowsToRead = 25; 
                    for (let i = dataStartRowIndex; i < dataStartRowIndex + rowsToRead && i < sheetData.length; i++) {
                        const row = sheetData[i] || [];
                        const metricName = String(row[3] || "").trim();
                        // Se la metrica ha un nome o se la riga non è completamente vuota, la includiamo
                        if (metricName || row.slice(4).some(cell => cell !== null)) {
                            const values = row.slice(4, 4 + numDaysInMonth);
                            // Sostituiamo 'null' con stringhe vuote per coerenza
                            metrics.push({ name: metricName, values: values.map(v => v === null ? '' : v) });
                        }
                    }

                    const parsedData = { period: periodo, dateHeaders, metrics };
                    await setDoc(getDocumentRef('datiMensili', periodo), parsedData);
                    resolve('File elaborato e salvato con successo.');
                } catch (err) {
                    console.error("Errore processamento file:", err);
                    reject(`Errore: ${err.message}`);
                }
            };
            reader.readAsBinaryString(file);
        });
        toast.promise(processPromise, {
            loading: 'Elaborazione file...',
            success: (msg) => msg,
            error: (err) => err
        });
    };

    const handleDownloadTemplate = () => {
        try {
            if (!window.XLSX) { throw new Error("Libreria XLSX non disponibile."); }
            const month = periodo.slice(5,7);
            const year = periodo.slice(0,4);
            const numDaysInMonth = new Date(year, month, 0).getDate();
            const headers = ['','','','Metrica'];
            for(let i=1; i <= numDaysInMonth; i++){ headers.push(`${String(i).padStart(2, '0')}/${month}/${year}`); }
            const exampleMetrics = [
                'Saldato TGT', 'Saldato CY', 'DELTA ROLLING', 'WO TGT', 'WO CY', 'DELTA ROLLING', 'Saldato vs TARGET', '',
                'Numero pacchetti lac commissionati', '',
                'First TGT', 'Second TGT', 'First ACT', 'Second ACT', '', 'Delta rolling 1st', 'Delta rolling 2nd'
            ];
            const data = exampleMetrics.map(metric => {
                const row = ['','','', metric];
                // Lasciamo vuoti i valori per i separatori
                if (metric !== '') {
                    for (let i = 0; i < numDaysInMonth; i++) row.push(0);
                }
                return row;
            });
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `Template ${month}-${year}`);
            XLSX.writeFile(workbook, `template_dati_mensili_${month}_${year}.xlsx`);
            toast.success("Template scaricato!");
        } catch(err) {
            toast.error(`Errore creazione template: ${err.message}`);
        }
    };

    // NUOVA FUNZIONE PER LA LOGICA DI RENDER DELLE CELLE
    const renderCellContent = (metricName, value) => {
        const isPercentage = metricName.toLowerCase() === 'saldato vs target';
        const isNumeric = typeof value === 'number';

        if (isPercentage && isNumeric) {
            return `${(value * 100).toFixed(0)}%`;
        }
        if (isNumeric) {
            return value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        // Se il valore è vuoto o non è un numero, non mostrare nulla
        return value || '';
    };

    return (
        <div>
            <h3 className="text-2xl font-semibold mb-4">Dati Mensili</h3>
            <div className="flex items-center gap-4 mb-4 bg-gray-50 p-4 rounded-lg flex-wrap">
                <Input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} />
                <Input type="file" accept=".xlsx,.xls" onChange={handleFileProcess} />
                <Button onClick={handleDownloadTemplate} icon={FileDown} variant="teal">Scarica Template</Button>
            </div>
            <div className="overflow-x-auto border rounded-lg">
                {isLoading ? <p className="p-4">Caricamento dati...</p> : datiMensili.metrics ? (
                    <table className="min-w-full bg-white text-sm">
                        <thead className="sticky top-0 bg-gray-100 z-10">
                            <tr>
                                <th className="py-2 px-4 border-b border-r font-semibold text-left sticky left-0 bg-gray-100 w-64">Metrica</th>
                                {/* MODIFICA: Mostra DD/MM nell'header */}
                                {datiMensili.dateHeaders.map(h => <th key={h} className="py-2 px-3 border-b font-normal text-gray-600 w-24">{h.substring(0, 5)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {datiMensili.metrics.map((m, metricIndex) => {
                                // MODIFICA: Logica per aggiungere i separatori
                                if (m.name === '') {
                                    return (
                                        <tr key={`spacer-${metricIndex}`} className="h-4 bg-gray-50">
                                            <td colSpan={datiMensili.dateHeaders.length + 1}></td>
                                        </tr>
                                    );
                                }
                                return (
                                <tr key={m.name || `row-${metricIndex}`} className="hover:bg-gray-50">
                                    <td className="py-2 px-4 border-b border-r font-semibold sticky left-0 bg-white hover:bg-gray-50">{m.name}</td>
                                    {m.values.map((v, i) => (
                                        <td 
                                            key={i} 
                                            // MODIFICA: Applica stili dinamicamente
                                            className={`
                                                py-2 px-3 border-b text-right
                                                ${(v === '' || v === null) ? 'bg-gray-200' : ''}
                                            `}
                                        >
                                            {/* MODIFICA: Usa la funzione di render per formattare il contenuto */}
                                            {renderCellContent(m.name, v)}
                                        </td>
                                    ))}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : <p className="text-gray-500 p-8 text-center bg-gray-50">Nessun dato per il periodo selezionato. Carica un file Excel per iniziare.</p>}
            </div>
        </div>
    );
};

const InvioChiusura = ({ vendite, emailAmministrazioni, onClose, datiChiusuraGiornaliera }) => {
    const [selectedEmails, setSelectedEmails] = React.useState([]);
    const [isSending, setIsSending] = React.useState(false);
    const [manualInputs, setManualInputs] = React.useState({
        fatturato: '',
        pacchetti: '',
        sole: '',
        valoreSole: ''
    });

    React.useEffect(() => {
        setManualInputs({
            fatturato: '',
            pacchetti: '',
            sole: '',
            valoreSole: ''
        });
    }, [datiChiusuraGiornaliera]);


    const datiOggi = React.useMemo(() => {
        const oggi = new Date();
        const venditeDelGiorno = vendite.filter(v => {
            if (!v.data) return false;
            const [day, month, year] = v.data.split('/');
            return new Date(`${year}-${month}-${day}`).toDateString() === oggi.toDateString();
        });

        const sommario = venditeDelGiorno.reduce((acc, v) => {
            acc.totaleWO += v.importo || 0;
            if (v.ordine_lente === 'Primo') acc.primiOrdini++;
            else acc.secondiOrdini++;
            return acc;
        }, { totaleWO: 0, primiOrdini: 0, secondiOrdini: 0 });
        
        return { sommario, venditeDelGiorno };
    }, [vendite]);


    const displayData = React.useMemo(() => {
        const saldatoTgt = parseFloat(datiChiusuraGiornaliera?.saldatoTgt) || 0;
        const woTgt = parseFloat(datiChiusuraGiornaliera?.woTgt) || 0;
        
        const woCy = datiOggi.sommario.totaleWO;

        const manualFatturatoValue = parseFloat(manualInputs.fatturato);
        const saldatoCy = !isNaN(manualFatturatoValue) 
            ? manualFatturatoValue 
            : (parseFloat(datiChiusuraGiornaliera?.saldatoCy) || 0);

        const deltaRollingSaldato = saldatoCy - saldatoTgt;
        const deltaRollingWo = woCy - woTgt;
        
        const percSaldatoVsTarget = saldatoTgt !== 0 ? (deltaRollingSaldato / saldatoTgt) * 100 : 0;

        return { saldatoTgt, saldatoCy, deltaRollingSaldato, woTgt, woCy, deltaRollingWo, percSaldatoVsTarget };
    }, [datiChiusuraGiornaliera, manualInputs, datiOggi]);
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setManualInputs(prev => ({ ...prev, [name]: value }));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (selectedEmails.length === 0) {
            toast.error("Seleziona almeno un destinatario.");
            return;
        }
        setIsSending(true);

        const { fatturato, pacchetti, sole, valoreSole } = manualInputs;

        const oggi = new Date();
        const periodYYYYMM = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
        try {
            const docRef = getDocumentRef('datiMensili', periodYYYYMM);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const adminData = docSnap.data();
                const oggiStr = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
                const dayColumnIndex = adminData.dateHeaders.findIndex(h => h === oggiStr);
                if (dayColumnIndex !== -1) {
                    const metricheDaAggiornare = {
                        'saldato cy': parseFloat(fatturato) || 0,
                        'wo cy': datiOggi.sommario.totaleWO,
                        'first act': datiOggi.sommario.primiOrdini,
                        'second act': datiOggi.sommario.secondiOrdini
                    };
                    adminData.metrics.forEach(metric => {
                        const metricNameLower = metric.name.trim().toLowerCase();
                        if (metricheDaAggiornare.hasOwnProperty(metricNameLower)) {
                            metric.values[dayColumnIndex] = metricheDaAggiornare[metricNameLower];
                        }
                    });
                    await setDoc(getDocumentRef('datiMensili', periodYYYYMM), adminData);
                    toast.success("Dati di chiusura salvati nel gestionale.");
                }
            }
        } catch (error) {
            console.error("Errore nel salvataggio dei dati di chiusura:", error);
            toast.error(`Errore salvataggio dati: ${error.message}`);
        }
        
        let body = `Buonasera,\n\n`;
        body += `la giornata odierna si chiude con un fatturato di ${(parseFloat(fatturato) || 0).toFixed(2)} Euro e un commissionato di ${datiOggi.sommario.totaleWO.toFixed(2)} Euro.\n`;
        body += `composto da ${datiOggi.sommario.primiOrdini} primi e ${datiOggi.sommario.secondiOrdini} secondi.\n`;
        if (parseInt(sole || '0', 10) > 0) {
            body += `Occhiali da sole venduti: ${parseInt(sole, 10)} per un valore di ${(parseFloat(valoreSole) || 0).toFixed(2)} Euro.\n`;
        }
        if (parseInt(pacchetti || '0', 10) > 0) {
            body += `Pacchetti LAC venduti: ${parseInt(pacchetti, 10)}.\n`;
        }
        
        // --- NUOVO BLOCCO RIEPILOGO ---
        // Questo codice crea una versione testuale del riquadro di riepilogo
        const formatNumber = (num) => (num || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const labelWidth = 20;

        body += '\n\n--- RIEPILOGO GIORNALIERO ---\n\n';
        body += `${'Saldato TGT:'.padEnd(labelWidth)} ${formatNumber(displayData.saldatoTgt)}\n`;
        body += `${'Saldato CY:'.padEnd(labelWidth)} ${formatNumber(displayData.saldatoCy)}\n`;
        body += `${'DELTA ROLLING:'.padEnd(labelWidth)} ${formatNumber(displayData.deltaRollingSaldato)}\n`;
        body += '\n'; 
        body += `${'WO TGT:'.padEnd(labelWidth)} ${formatNumber(displayData.woTgt)}\n`;
        body += `${'WO CY:'.padEnd(labelWidth)} ${formatNumber(displayData.woCy)}\n`;
        body += `${'DELTA ROLLING:'.padEnd(labelWidth)} ${formatNumber(displayData.deltaRollingWo)}\n`;
        body += '\n';
        body += `${'Saldato vs TARGET:'.padEnd(labelWidth)} ${displayData.percSaldatoVsTarget.toFixed(0)}%\n\n`;
        // --- FINE NUOVO BLOCCO ---

        if (datiOggi.venditeDelGiorno.length > 0) {
            body += `--- DETTAGLIO VENDITE COMMISSIONATE (WO) ---\n\n`;
            const header = 'Venditore'.padEnd(20) + 'N. WO'.padEnd(15) + 'Tipo'.padEnd(15) + 'Lente'.padEnd(15) + 'Trattamenti'.padEnd(35) + 'Importo'.padEnd(20);
            body += header + '\n';
            body += '-'.repeat(header.length) + '\n';
            datiOggi.venditeDelGiorno.forEach(v => {
                const importoStr = `${(v.importo || 0).toFixed(2)} Euro`;
                const trattamentiStr = (v.trattamenti || []).join(', ') || 'Nessuno';
                const row = (v.venditore || 'N/D').padEnd(20) + (v.numero_ordine || 'N/D').padEnd(15) + (v.ordine_lente || 'N/D').padEnd(15) + (v.tipo_lente || 'N/D').padEnd(15) + trattamentiStr.padEnd(35) + importoStr.padEnd(20);
                body += row + '\n';
            });
            body += '\n';
        }
        body += `Saluti,\nIl Sistema Gestionale`;

        const mailtoLink = `mailto:${selectedEmails.join(',')}?subject=Report Chiusura Giornaliera&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
        toast.success("Il client di posta è stato aperto.");
        setIsSending(false);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Invio Report Chiusura Giornaliera" size="max-w-5xl">
            <form onSubmit={handleSend}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="font-bold">1. Seleziona Destinatari</label>
                        <div className="p-2 border rounded-md mt-2 max-h-60 overflow-y-auto bg-gray-50">
                            {emailAmministrazioni.map(e => (
                                <label key={e.id} className="flex items-center p-1">
                                    <input type="checkbox" value={e.email} onChange={(evt) => {
                                        if (evt.target.checked) setSelectedEmails([...selectedEmails, e.email]);
                                        else setSelectedEmails(selectedEmails.filter(em => em !== e.email));
                                    }} className="mr-2" />
                                    {e.nomeContatto} ({e.email})
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">
                         <h3 className="font-semibold text-gray-800 text-center border-b border-blue-500 pb-1 mb-2 text-sm">
                             {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                         </h3>
                         <div className="space-y-1 text-xs font-sans">
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">Saldato TGT</span><span className="font-bold text-sm">{displayData.saldatoTgt.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">Saldato CY</span><span className="font-bold text-sm">{displayData.saldatoCy.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">DELTA ROLLING</span><span className={`font-bold text-sm ${displayData.deltaRollingSaldato >= 0 ? 'text-green-600' : 'text-red-600'}`}>{displayData.deltaRollingSaldato.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="pt-1"></div>
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">WO TGT</span><span className="font-bold text-sm">{displayData.woTgt.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">WO CY</span><span className="font-bold text-sm">{displayData.woCy.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="flex justify-between items-center px-1"><span className="font-medium text-gray-600">DELTA ROLLING</span><span className={`font-bold text-sm ${displayData.deltaRollingWo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{displayData.deltaRollingWo.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span></div>
                            <div className="pt-1"></div>
                            <div className="flex justify-between items-center p-1 bg-gray-300 rounded-md mt-1">
                                <span className="font-bold text-gray-800 text-sm">Saldato vs TARGET</span>
                                <span className={`font-bold text-sm ${displayData.percSaldatoVsTarget >= 0 ? 'text-green-600' : 'text-red-600'}`}>{displayData.percSaldatoVsTarget.toFixed(0)}%</span>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="mb-4">
                    <strong className="font-bold">2. Dati Calcolati da WO (Work Order) di Oggi</strong>
                    <div className="grid grid-cols-3 gap-4 p-2 bg-gray-50 rounded-md mt-2">
                        <p><strong>Totale WO:</strong> {datiOggi.sommario.totaleWO.toFixed(2)} €</p>
                        <p><strong>Primi:</strong> {datiOggi.sommario.primiOrdini}</p>
                        <p><strong>Secondi:</strong> {datiOggi.sommario.secondiOrdini}</p>
                    </div>
                </div>
                
                <div className="mb-4">
                    <strong className="font-bold">3. Dettaglio Vendite Commissionate (WO) di Oggi</strong>
                    <div className="mt-2 border rounded-lg overflow-y-auto max-h-60">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    {['Data', 'Venditore', 'N. Ordine', 'Primo/Secondo', 'Tipo Lente', 'Importo', 'Trattamenti'].map(h => 
                                        <th key={h} className="py-2 px-3 border-b text-left font-semibold">{h}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {datiOggi.venditeDelGiorno.length > 0 ? datiOggi.venditeDelGiorno.map(v => (
                                    <tr key={v.id} className="hover:bg-gray-50 border-b">
                                        <td className="py-2 px-3">{v.data}</td>
                                        <td className="py-2 px-3">{v.venditore}</td>
                                        <td className="py-2 px-3">{v.numero_ordine}</td>
                                        <td className="py-2 px-3">{v.ordine_lente}</td>
                                        <td className="py-2 px-3">{v.tipo_lente}</td>
                                        <td className="py-2 px-3 text-right">{(v.importo || 0).toFixed(2)} €</td>
                                        <td className="py-2 px-3">{(v.trattamenti || []).join(', ')}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-4 text-gray-500">Nessuna vendita commissionata oggi.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mb-4">
                    <strong className="font-bold">4. Inserisci Totali Manuali di Cassa</strong>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div><label>Fatturato Cassa (€)</label><Input type="number" name="fatturato" value={manualInputs.fatturato} onChange={handleInputChange} step="0.01" required /></div>
                        <div><label>N. Pacchetti LAC</label><Input type="number" name="pacchetti" value={manualInputs.pacchetti} onChange={handleInputChange} /></div>
                        <div><label>N. Occhiali Sole</label><Input type="number" name="sole" value={manualInputs.sole} onChange={handleInputChange} /></div>
                        <div><label>Valore Sole (€)</label><Input type="number" name="valoreSole" value={manualInputs.valoreSole} onChange={handleInputChange} step="0.01" /></div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button type="button" onClick={onClose} variant="neutral" disabled={isSending}>Annulla</Button>
                    <Button type="submit" icon={Send} isLoading={isSending}>Prepara Email</Button>
                </div>
            </form>
        </Modal>
    );
};

const FiltraPdf = ({ vendite, venditori, onClose }) => {
    const [alertState, setAlertState] = React.useState({ isOpen: false, title: '', message: '' });
    const [visualizzazioneDati, setVisualizzazioneDati] = React.useState([]);
    const [mostraVisualizzazione, setMostraVisualizzazione] = React.useState(false);
    const formRef = React.useRef(null);

    const getFilteredData = (formElement) => {
        const formData = new FormData(formElement);
        const filters = Object.fromEntries(formData.entries());
        const stati = formData.getAll('stato_ordine');
        const utilizzoSosOnly = filters.utilizzo_sos === 'true';
        const escludiSos = filters.escludi_sos === 'true';

        return vendite.filter(v => {
            if (!v.data) return false;
            const vDate = new Date(v.data.split('/').reverse().join('-'));
            const startDate = new Date(filters.startDate);
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);

            const utilizzoSosMatch = !utilizzoSosOnly || (v.trattamenti && v.trattamenti.includes('Utilizzo SOS'));
            
            const escludiSosMatch = !escludiSos || !v.trattamenti || !v.trattamenti.includes('Utilizzo SOS');

            return vDate >= startDate && vDate <= endDate &&
                (!filters.venditore || v.venditore === filters.venditore) &&
                (!filters.tipo_lente || v.tipo_lente === filters.tipo_lente) &&
                (!filters.ordine_lente || v.ordine_lente === filters.ordine_lente) &&
                (!filters.trattamento || (v.trattamenti && v.trattamenti.includes(filters.trattamento))) &&
                (stati.length === 0 || stati.includes(v.stato_ordine)) &&
                utilizzoSosMatch &&
                escludiSosMatch;
        });
    }

    const handleGeneratePdf = (e) => {
        e.preventDefault();
        if (!window.jspdf || !window.jspdf.jsPDF) {
            toast.error("Libreria PDF non disponibile.");
            return;
        }

        const filteredVendite = getFilteredData(e.target);

        if (filteredVendite.length === 0) {
            toast.error("Nessuna vendita trovata per i filtri selezionati.");
            return;
        }

        const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
        doc.text(`Report Vendite Filtrato`, 14, 16);
        const body = filteredVendite.map(v => [v.data, v.cliente, v.venditore, v.tipo_lente, v.ordine_lente, v.rif_vaschetta, v.numero_ordine, v.stato_ordine, (v.importo || 0).toFixed(2), (v.trattamenti || []).join(', ')]);
        doc.autoTable({
            head: [['Data', 'Cliente', 'Venditore', 'Tipo Lente', 'Ordine Lente', 'Rif.Vaschetta', 'N. Ordine', 'Stato', 'Importo (€)', 'Trattamenti']],
            body: body, startY: 20, theme: 'striped', styles: { fontSize: 7 }
        });
        doc.save(`Report_WO_Filtrato_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("PDF generato con successo!");
        onClose();
    };
    
    const handleVisualizza = () => {
        const filteredVendite = getFilteredData(formRef.current);
        if (filteredVendite.length === 0) {
            toast.error("Nessuna vendita trovata per i filtri selezionati.");
            return;
        }
        setVisualizzazioneDati(filteredVendite);
        setMostraVisualizzazione(true);
    };

    const renderVisualizzazione = () => (
        <div>
            <div className="overflow-y-auto max-h-[60vh] border rounded-lg">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            {['Data', 'Cliente', 'Venditore', 'Tipo Lente', 'Ordine', 'Vaschetta', 'N. Ordine', 'Stato', 'Importo', 'Trattamenti'].map(h => <th key={h} className="py-2 px-3 border-b text-left font-semibold">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {visualizzazioneDati.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50 border-b">
                                <td className="py-2 px-3">{v.data}</td>
                                <td className="py-2 px-3">{v.cliente}</td>
                                <td className="py-2 px-3">{v.venditore}</td>
                                <td className="py-2 px-3">{v.tipo_lente}</td>
                                <td className="py-2 px-3">{v.ordine_lente}</td>
                                <td className="py-2 px-3">{v.rif_vaschetta}</td>
                                <td className="py-2 px-3">{v.numero_ordine}</td>
                                <td className="py-2 px-3 font-semibold">{v.stato_ordine}</td>
                                <td className="py-2 px-3 text-right">{(v.importo || 0).toFixed(2)} €</td>
                                <td className="py-2 px-3">{(v.trattamenti || []).join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end mt-4">
                <Button onClick={() => setMostraVisualizzazione(false)} variant="neutral">Indietro ai Filtri</Button>
            </div>
        </div>
    );

    const renderFormFiltri = () => (
        <form ref={formRef} onSubmit={handleGeneratePdf}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div><label>Data Inizio</label><Input type="date" name="startDate" defaultValue={new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]} required /></div>
                <div><label>Data Fine</label><Input type="date" name="endDate" defaultValue={new Date().toISOString().split('T')[0]} required /></div>
                <div><label>Venditore</label><Select name="venditore"><option value="">Tutti</option>{venditori.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}</Select></div>
                <div><label>Tipo Lente</label><Select name="tipo_lente"><option value="">Tutti</option><option>Monofocale</option><option>Multifocale</option><option>Office</option></Select></div>
                <div><label>Ordine Lente</label><Select name="ordine_lente"><option value="">Tutti</option><option>Primo</option><option>Secondo</option></Select></div>
                <div><label>Trattamento</label><Select name="trattamento"><option value="">Tutti</option><option>Transition</option><option>Luce Blu</option><option>Sun RX</option><option>SOS</option></Select></div>
            </div>
            <div className="mb-4">
                <label>Stato Ordine (lasciare deselezionati per includerli tutti)</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 p-2 border rounded-md">
                    {['ORDINE IN CORSO','PRONTO', 'CONSEGNATO', 'CONTROLLO TECNICO', 'SOSTITUZIONE IN GARANZIA'].map(s => <label key={s} className="flex items-center text-sm"><input type="checkbox" name="stato_ordine" value={s} className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />{s}</label>)}
                </div>
            </div>
            <div className="mb-4">
                <label>Filtri Aggiuntivi</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 p-2 border rounded-md">
                   <label className="flex items-center text-sm">
                       <input type="checkbox" name="utilizzo_sos" value="true" className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                       Ricerca SOLO "Utilizzo SOS"
                   </label>
                   <label className="flex items-center text-sm">
                       <input type="checkbox" name="escludi_sos" value="true" className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                       Escludi dalla ricerca "Utilizzo SOS"
                   </label>
                </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
                <Button type="button" onClick={onClose} variant="neutral">Annulla</Button>
                <Button type="button" onClick={handleVisualizza} icon={Eye} variant="success">Visualizza</Button>
                <Button type="submit" icon={Download}>Genera PDF</Button>
            </div>
        </form>
    );

    return (
        <Modal 
            isOpen={true} 
            onClose={onClose} 
            title={mostraVisualizzazione ? "Risultati Filtro" : "Filtra Elenco WO"} 
            size={mostraVisualizzazione ? "max-w-7xl" : "max-w-4xl"}
        >
            <AlertModal {...alertState} onClose={() => setAlertState({ ...alertState, isOpen: false })} />
            {mostraVisualizzazione ? renderVisualizzazione() : renderFormFiltri()}
        </Modal>
    );
};


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
    }, [contatto, initialType, isOpen]); // Aggiunto isOpen per resettare il form se non c'è un contatto

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
            id: Date.now(), // Unique key for react list
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
            if (contatto) { // Modifica
                await updateDoc(getDocumentRef('contatti_lenti', contatto.id), dataToSave);
            } else { // Creazione
                await addDoc(getCollectionRef('contatti_lenti'), dataToSave);
            }
            toast.success('Cliente salvato con successo!');
            onSave(); // Chiude la modale
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


// --- COMPONENTE PRINCIPALE APP ---
export default function App() {
    const [activeSection, setActiveSection] = React.useState('dashboard');
    const [activeSubView, setActiveSubView] = React.useState(null);
    const [user, setUser] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [obiettivi, setObiettivi] = React.useState({ budget: 'N/D', wo: 'N/D' });

    // Caricamento dati da Firestore
    const vendite = useFirestoreCollection('vendite', isAuthReady);
    const venditori = useFirestoreCollection('venditori', isAuthReady);
    const emailAmministrazioni = useFirestoreCollection('emailAmministrazioni', isAuthReady);
    const datiMensiliRaw = useFirestoreCollection('datiMensili', isAuthReady);
    const riparazioni = useFirestoreCollection('riparazioni', isAuthReady);
    const contatti = useFirestoreCollection('contatti_lenti', isAuthReady, { orderBy: 'cliente' });

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setIsAuthReady(true);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Errore di autenticazione:", error);
                    setIsAuthReady(true);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!isAuthReady) return;
        const oggi = new Date();
        const periodYYYYMM = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
        const datiMeseCorrente = datiMensiliRaw.find(d => d.id === periodYYYYMM);
        if (datiMeseCorrente) {
            const oggiStr = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
            const dayIndex = datiMeseCorrente.dateHeaders.findIndex(h => h === oggiStr);
            if (dayIndex !== -1) {
                const budgetMetric = datiMeseCorrente.metrics.find(m => m.name.toLowerCase() === 'saldato tgt');
                const woMetric = datiMeseCorrente.metrics.find(m => m.name.toLowerCase() === 'wo tgt');
                const budgetValue = budgetMetric ? (budgetMetric.values[dayIndex] || 'N/D') : 'N/D';
                const woValue = woMetric ? (woMetric.values[dayIndex] || 'N/D') : 'N/D';
                setObiettivi({
                    budget: typeof budgetValue === 'number' ? `${budgetValue.toFixed(2)} €` : budgetValue,
                    wo: typeof woValue === 'number' ? woValue.toFixed(2) : woValue,
                });
            } else { setObiettivi({ budget: 'N/D', wo: 'N/D' }); }
        } else { setObiettivi({ budget: 'N/D', wo: 'N/D' }); }
    }, [datiMensiliRaw, isAuthReady]);
    
    const handleNavigation = (section, subView = null) => {
        setActiveSection(section);
        setActiveSubView(subView);
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'dashboard': return <Dashboard vendite={vendite} riparazioni={riparazioni} obiettivi={obiettivi} onNavigate={handleNavigation} />;
            case 'amministrazione': return <Amministrazione venditori={venditori} emailAmministrazioni={emailAmministrazioni} vendite={vendite} datiMensiliRaw={datiMensiliRaw} />;
            case 'laboratorio': return <Laboratorio vendite={vendite} venditori={venditori} riparazioni={riparazioni} contatti={contatti} initialSubView={activeSubView || 'ricerca'} />;
            case 'contattologia': return <Contattologia contatti={contatti} initialAction={activeSubView} onActionComplete={() => setActiveSubView(null)} />;
            default: return <Dashboard vendite={vendite} riparazioni={riparazioni} obiettivi={obiettivi} onNavigate={handleNavigation} />;
        }
    };

    const SidebarButton = ({ section, label, icon: Icon }) => (
        <button onClick={() => handleNavigation(section)} className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${activeSection === section ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-200'}`}>
            <Icon size={20} className="mr-3" />
            <span className="font-semibold">{label}</span>
        </button>
    );

    if (!isAuthReady) {
        return (
            <div className="h-screen w-screen flex justify-center items-center bg-gray-100">
                <div className="text-center">
                    <p className="text-xl font-semibold">Caricamento e autenticazione...</p>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mt-4"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* --- NUOVO: Contenitore per le notifiche toast, si posizionerà sopra tutto il resto --- */}
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#363636',
                        color: '#fff',
                    },
                    success: {
                        duration: 3000,
                        theme: {
                            primary: 'green',
                            secondary: 'black',
                        },
                    },
                }}
            />

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
                .whitespace-pre-wrap { white-space: pre-wrap; }
            `}</style>
            <div className="w-64 bg-white shadow-md flex flex-col p-4">
                <div className="mb-8"><h1 className="text-2xl font-bold text-gray-800">VisionOttica</h1><p className="text-sm text-gray-500">Console Gestionale</p></div>
                <nav className="flex flex-col gap-2">
                    <SidebarButton section="dashboard" label="Dashboard" icon={LayoutDashboard} />
                    <SidebarButton section="laboratorio" label="Laboratorio" icon={FlaskConical} />
                    <SidebarButton section="amministrazione" label="Amministrazione" icon={Settings} />
                    <SidebarButton section="contattologia" label="Contattologia" icon={Contact} />
                </nav>
                <div className="mt-auto bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-bold text-blue-800 mb-2 text-lg">Obiettivo Giornaliero</h3>
                    <p className="text-sm text-gray-700"><strong>Data:</strong> {new Date().toLocaleDateString('it-IT')}</p>
                    <p className="text-sm text-gray-700"><strong>TGT Fatturato:</strong> <span className="font-bold">{obiettivi.budget}</span></p>
                    <p className="text-sm text-gray-700"><strong>TGT WO:</strong> <span className="font-bold">{obiettivi.wo}{obiettivi.wo !== 'N/D' && ' €'}</span></p>
                </div>
                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-bold text-gray-700 mb-2">Info Utente</h3>
                    <p className="text-xs break-words"><strong>UserID:</strong> {user ? user.uid : 'N/A'}</p>
                </div>
            </div>
            <main className="flex-1 p-8 overflow-y-auto">{renderSection()}</main>
        </div>
    );
}