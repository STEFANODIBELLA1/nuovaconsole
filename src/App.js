/* global __initial_auth_token */
// ===================================================================================
// --- APP ROOT ---
// Shell principale: gestione autenticazione, caricamento dati da Firestore,
// routing fra le sezioni (Dashboard, Laboratorio, Amministrazione, Contattologia).
// La logica e i componenti sono suddivisi in file separati per chiarezza:
//   - Contattologia.js   → utilities, hooks, UI generici, sezione Contattologia
//   - DashboardLaboratorio.js → Dashboard + Laboratorio + modali relative
//   - Amministrazione.js → Statistiche + Amministrazione + modali relative
// ===================================================================================

import React from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { LayoutDashboard, FlaskConical, Contact, Settings, RefreshCw, Menu, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Import dai moduli suddivisi
import {
    auth, useFirestoreCollection, Button, Contattologia
} from './Contattologia';
import { Dashboard, Laboratorio } from './DashboardLaboratorio';
import { Amministrazione } from './Amministrazione';

// --- COMPONENTE PRINCIPALE APP ---
export default function App() {
    const [activeSection, setActiveSection] = React.useState('dashboard');
    const [activeSubView, setActiveSubView] = React.useState(null);
    const [user, setUser] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [obiettivi, setObiettivi] = React.useState({ budget: 'N/D', wo: 'N/D' });
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // STATO PER RECUPERO DATI
    const [inputCodice, setInputCodice] = React.useState(() => localStorage.getItem('visionottica_userid') || '');
    const [refreshTrigger, setRefreshTrigger] = React.useState(0);

    // Caricamento dati da Firestore
    const vendite = useFirestoreCollection('vendite', isAuthReady, refreshTrigger);
    const venditori = useFirestoreCollection('venditori', isAuthReady, refreshTrigger);
    const emailAmministrazioni = useFirestoreCollection('emailAmministrazioni', isAuthReady, refreshTrigger);
    const datiMensiliRaw = useFirestoreCollection('datiMensili', isAuthReady, refreshTrigger);
    const riparazioni = useFirestoreCollection('riparazioni', isAuthReady, refreshTrigger);
    const contatti = useFirestoreCollection('contatti_lenti', isAuthReady, refreshTrigger, { orderBy: 'cliente' });

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

    // Auto-aggiornamento al caricamento se c'è un UserID salvato
    React.useEffect(() => {
        if (!isAuthReady) return;
        const savedId = localStorage.getItem('visionottica_userid');
        if (savedId) {
            window.mioCodiceUtente = savedId;
            setRefreshTrigger(prev => prev + 1);
        }
    }, [isAuthReady]);

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
        setIsSidebarOpen(false);
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
        <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: { background: '#363636', color: '#fff' },
                    success: { duration: 3000, theme: { primary: 'green', secondary: 'black' } },
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

            {/* Overlay mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-30 w-72 bg-white shadow-lg flex flex-col p-4
                transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:w-64 md:translate-x-0 md:shadow-md md:z-auto
            `}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">VisionOttica</h1>
                        <p className="text-sm text-gray-500">Console Gestionale</p>
                    </div>
                    <button
                        className="md:hidden text-gray-500 hover:text-gray-800 p-1"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X size={22} />
                    </button>
                </div>

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
                    <h3 className="font-bold text-gray-700 mb-2">Recupero Dati</h3>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={inputCodice}
                            onChange={(e) => setInputCodice(e.target.value)}
                            className="w-full p-2 text-xs border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            placeholder="Incolla UserID qui..."
                        />
                        <Button
                            onClick={() => {
                                window.mioCodiceUtente = inputCodice;
                                localStorage.setItem('visionottica_userid', inputCodice);
                                toast.loading('Sincronizzazione dati in corso...', { id: 'refresh', duration: 1200 });
                                setRefreshTrigger(prev => prev + 1);
                            }}
                            variant="primary"
                            className="w-full text-xs mt-2 py-2"
                            icon={RefreshCw}
                        >
                            Aggiorna Dati
                        </Button>
                        <p className="text-[10px] text-gray-400 mt-2 break-all">ID Attuale:<br />{user ? user.uid : 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Barra superiore mobile */}
                <div className="md:hidden flex items-center gap-3 bg-white shadow-sm px-4 py-3 flex-shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="text-gray-700 hover:text-gray-900"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-800">VisionOttica</h1>
                    <span className="ml-auto text-sm font-semibold text-blue-700 capitalize">{activeSection}</span>
                </div>

                <main key={refreshTrigger} className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {renderSection()}
                </main>
            </div>
        </div>
    );
}
