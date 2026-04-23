/* global __initial_auth_token */
import React from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { LayoutDashboard, FlaskConical, Contact, Settings, Menu, X, LogOut, Lock, ChevronLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { auth, db, appId, useFirestoreCollection, usePolos, Button, Contattologia } from './Contattologia';
import { Dashboard, Laboratorio } from './DashboardLaboratorio';
import { Amministrazione } from './Amministrazione';

// ─── SCHERMATA INIZIALE ────────────────────────────────────────────────────────
const StartupScreen = ({ onNegozio, onAreaManager }) => (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-1">VisionOttica</h1>
            <p className="text-gray-400 text-sm mb-8">Console Gestionale</p>
            <div className="space-y-3">
                <button onClick={onNegozio}
                    className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors">
                    Accedi come Negozio
                </button>
                <button onClick={onAreaManager}
                    className="w-full p-4 border-2 border-purple-200 text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
                    Area Manager
                </button>
            </div>
        </div>
    </div>
);

// ─── CONFIGURAZIONE NEGOZIO (prima volta) ─────────────────────────────────────
const NegozioSetup = ({ firebaseUid, onBack, onComplete }) => {
    const [step, setStep] = React.useState('polo');
    const [codice, setCodice] = React.useState('');
    const [userId, setUserId] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const registerAndEnter = async (uid) => {
        setSaving(true);
        const polo = { codice: codice.trim(), nome: `Polo ${codice.trim()}`, userId: uid, ruolo: 'negozio' };
        try {
            // Usa il codice polo come ID documento — evita duplicati, preserva nome esistente
            await setDoc(doc(db, `artifacts/${appId}/polos`, codice.trim()), {
                ...polo, createdAt: new Date().toISOString()
            }, { merge: true });
            onComplete(polo);
        } catch {
            toast.error('Errore durante la registrazione. Riprova.');
            setSaving(false);
        }
    };

    if (step === 'polo') return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
                <button onClick={onBack} className="text-sm text-gray-400 mb-4 block hover:text-gray-600">← Indietro</button>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Configurazione Negozio</h2>
                <p className="text-gray-500 text-sm mb-6">Inserisci il codice polo assegnato a questo negozio</p>
                <input
                    value={codice} onChange={e => setCodice(e.target.value)}
                    placeholder="es. 6061"
                    autoFocus
                    className="w-full p-3 border rounded-xl text-2xl font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                />
                <button
                    onClick={() => { if (codice.trim()) setStep('userid'); }}
                    disabled={!codice.trim()}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                    Continua
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
                <button onClick={() => setStep('polo')} className="text-sm text-gray-400 mb-4 block hover:text-gray-600">← Indietro</button>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Polo <span className="text-blue-600">{codice}</span></h2>
                <p className="text-gray-500 text-sm mb-6">Collega al database esistente oppure creane uno nuovo</p>

                <div className="mb-5">
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Ho già un UserID Firebase</label>
                    <input
                        value={userId} onChange={e => setUserId(e.target.value)}
                        placeholder="Incolla UserID qui..."
                        className="w-full p-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                    />
                    <button
                        onClick={() => { if (userId.trim()) registerAndEnter(userId.trim()); }}
                        disabled={!userId.trim() || saving}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
                        Collega al database esistente
                    </button>
                </div>

                <div className="flex items-center gap-3 my-4">
                    <hr className="flex-1" /><span className="text-gray-400 text-xs">oppure</span><hr className="flex-1" />
                </div>

                <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Crea nuovo database</label>
                    <p className="text-xs text-gray-400 mb-3 font-mono break-all bg-gray-50 rounded p-2">
                        Il tuo nuovo ID sarà:<br />{firebaseUid || 'Caricamento...'}
                    </p>
                    <button
                        onClick={() => { if (firebaseUid) registerAndEnter(firebaseUid); }}
                        disabled={!firebaseUid || saving}
                        className="w-full py-2 border-2 border-green-500 text-green-700 rounded-lg font-semibold hover:bg-green-50 disabled:opacity-50 text-sm">
                        {saving ? 'Creazione...' : 'Crea nuovo ed entra'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── LOGIN AREA MANAGER ────────────────────────────────────────────────────────
const AreaManagerLogin = ({ onBack, onSuccess }) => {
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const configRef = doc(db, `artifacts/${appId}/config/areaManager`);
            const snap = await getDoc(configRef);
            // Se il documento non esiste, crea con password di default "admin"
            if (!snap.exists()) await setDoc(configRef, { password: 'admin' });
            const stored = snap.exists() ? snap.data().password : 'admin';
            if (password === stored) {
                onSuccess();
            } else {
                setError('Password errata.');
            }
        } catch { setError('Errore di connessione. Riprova.'); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
                <button onClick={onBack} className="text-sm text-gray-400 mb-4 block hover:text-gray-600">← Indietro</button>
                <div className="flex items-center gap-3 mb-1">
                    <Lock size={24} className="text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Area Manager</h2>
                </div>
                <p className="text-gray-400 text-sm mb-6">Inserisci la password per accedere</p>
                <form onSubmit={handleLogin} className="space-y-3">
                    <input
                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        autoFocus
                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={loading || !password}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50">
                        {loading ? 'Verifica...' : 'Accedi'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── HOME AREA MANAGER ─────────────────────────────────────────────────────────
const AM_SETTINGS_KEY = 'visionottica_am_settings';
const AM_SETTINGS_DEFAULT = {
    showLaboratorio: false,
    showContattologia: false,
    showChiusura: false,
    showImpostazioni: false,
    showAzioniRapide: false,
    showAttivitaRecenti: false,
};

const AreaManagerHome = ({ onSelectPolo, onLogout, amSettings, onSettingsChange }) => {
    const polos = usePolos();
    const [showForm, setShowForm] = React.useState(false);
    const [codice, setCodice] = React.useState('');
    const [nome, setNome] = React.useState('');
    const [userId, setUserId] = React.useState('');
    const [ruolo, setRuolo] = React.useState('negozio');
    const [saving, setSaving] = React.useState(false);
    const [showPwdForm, setShowPwdForm] = React.useState(false);
    const [newPwd, setNewPwd] = React.useState('');
    const [savingPwd, setSavingPwd] = React.useState(false);
    const [showSetup, setShowSetup] = React.useState(false);

    const setupItems = [
        { key: 'showLaboratorio',    label: 'Sezione Laboratorio' },
        { key: 'showContattologia',  label: 'Sezione Contattologia' },
        { key: 'showChiusura',       label: 'Invio Chiusura Giornaliera (Amministrazione)' },
        { key: 'showImpostazioni',   label: 'Impostazioni (Amministrazione)' },
        { key: 'showAzioniRapide',   label: 'Azioni Rapide (Dashboard)' },
        { key: 'showAttivitaRecenti',label: 'Attività Recenti (Dashboard)' },
    ];

    const handleSettingToggle = (key) => {
        const next = { ...amSettings, [key]: !amSettings[key] };
        onSettingsChange(next);
    };

    const handleAddPolo = async (e) => {
        e.preventDefault();
        const c = codice.trim(), n = nome.trim(), u = userId.trim();
        if (!c || !n || !u) { toast.error('Tutti i campi sono obbligatori.'); return; }
        setSaving(true);
        try {
            await setDoc(doc(db, `artifacts/${appId}/polos`, c), {
                codice: c, nome: n, userId: u, ruolo, createdAt: new Date().toISOString()
            });
            setCodice(''); setNome(''); setUserId(''); setRuolo('negozio');
            setShowForm(false);
            toast.success(`Console "${c}" aggiunta.`);
        } catch { toast.error('Errore durante il salvataggio.'); }
        setSaving(false);
    };

    const handleDeletePolo = async (id, c) => {
        if (!window.confirm(`Eliminare la console "${c}"?`)) return;
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, `artifacts/${appId}/polos`, id));
            toast.success('Console eliminata.');
        } catch { toast.error('Errore durante l\'eliminazione.'); }
    };

    const handleChangePwd = async (e) => {
        e.preventDefault();
        if (!newPwd.trim()) return;
        setSavingPwd(true);
        try {
            await setDoc(doc(db, `artifacts/${appId}/config/areaManager`), { password: newPwd.trim() });
            toast.success('Password aggiornata.');
            setNewPwd(''); setShowPwdForm(false);
        } catch { toast.error('Errore durante il salvataggio.'); }
        setSavingPwd(false);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff' } }} />

            <div className="bg-purple-700 text-white px-4 py-4 flex items-center justify-between shadow-md">
                <div>
                    <h1 className="text-xl font-bold">VisionOttica</h1>
                    <p className="text-purple-200 text-xs">Area Manager</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => { setShowPwdForm(false); setShowSetup(v => !v); }}
                        className="text-purple-200 hover:text-white flex items-center gap-1 text-xs">
                        <Settings size={14} /> Setup
                    </button>
                    <button onClick={() => { setShowSetup(false); setShowPwdForm(v => !v); }}
                        className="text-purple-200 hover:text-white flex items-center gap-1 text-xs">
                        <Lock size={14} /> Password
                    </button>
                    <button onClick={onLogout} title="Esci" className="text-purple-200 hover:text-white">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-4">
                {showSetup && (
                    <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-purple-100">
                        <p className="font-semibold text-gray-700 mb-1 text-sm">Setup Vista</p>
                        <p className="text-xs text-gray-400 mb-3">Attiva le sezioni che vuoi vedere nelle console</p>
                        <div className="divide-y divide-gray-50">
                            {setupItems.map(({ key, label }) => (
                                <label key={key} className="flex items-center justify-between py-2.5 cursor-pointer">
                                    <span className="text-sm text-gray-700">{label}</span>
                                    <div
                                        onClick={() => handleSettingToggle(key)}
                                        className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${amSettings[key] ? 'bg-purple-600' : 'bg-gray-200'}`}>
                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${amSettings[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {showPwdForm && (
                    <form onSubmit={handleChangePwd} className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-purple-100">
                        <p className="font-semibold text-gray-700 mb-3 text-sm">Cambia password Area Manager</p>
                        <div className="flex gap-2">
                            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                                placeholder="Nuova password"
                                className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                            <button type="submit" disabled={savingPwd || !newPwd.trim()}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                                Salva
                            </button>
                        </div>
                    </form>
                )}

                <h2 className="text-lg font-bold text-gray-700 mb-3">Console disponibili</h2>

                <div className="space-y-2 mb-4">
                    {polos.length === 0 && !showForm && (
                        <p className="text-gray-400 text-center py-8 text-sm">Nessuna console registrata.</p>
                    )}
                    {polos.map(polo => (
                        <div key={polo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <button onClick={() => onSelectPolo(polo)}
                                className="w-full text-left p-4 hover:bg-purple-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-black text-purple-700 text-xl">{polo.codice}</span>
                                        <span className="ml-3 text-gray-700 font-medium">{polo.nome}</span>
                                        {polo.ruolo === 'area_manager' && (
                                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">AM</span>
                                        )}
                                    </div>
                                    <ChevronLeft size={18} className="text-gray-300 rotate-180" />
                                </div>
                                <p className="text-xs text-gray-400 font-mono mt-1 truncate">{polo.userId}</p>
                            </button>
                            <div className="border-t border-gray-50 px-4 py-1.5 flex justify-end">
                                <button onClick={() => handleDeletePolo(polo.id, polo.codice)}
                                    className="text-xs text-red-400 hover:text-red-600 py-1">Elimina</button>
                            </div>
                        </div>
                    ))}
                </div>

                {!showForm ? (
                    <button onClick={() => setShowForm(true)}
                        className="w-full py-3 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-colors text-sm">
                        + Aggiungi nuova console
                    </button>
                ) : (
                    <form onSubmit={handleAddPolo} className="bg-white rounded-xl p-4 shadow-sm border border-purple-200 space-y-3">
                        <p className="font-semibold text-purple-800 text-sm">Nuova console</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Codice polo</label>
                                <input value={codice} onChange={e => setCodice(e.target.value)} placeholder="es. 6061"
                                    className="w-full p-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Nome negozio</label>
                                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="es. VisionOttica Catania"
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">UserID Firebase</label>
                            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="es. 3e4qJDou5Rf38tOgFnmkBRcC3f63"
                                className="w-full p-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Ruolo</label>
                            <select value={ruolo} onChange={e => setRuolo(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                                <option value="negozio">Negozio</option>
                                <option value="area_manager">Area Manager</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="flex-1 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-100">Annulla</button>
                            <button type="submit" disabled={saving}
                                className="flex-1 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                                {saving ? 'Salvataggio...' : 'Aggiungi'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

// ─── COMPONENTE PRINCIPALE APP ─────────────────────────────────────────────────
export default function App() {
    const [activeSection, setActiveSection] = React.useState('dashboard');
    const [activeSubView, setActiveSubView] = React.useState(null);
    const [user, setUser] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [obiettivi, setObiettivi] = React.useState({ budget: 'N/D', wo: 'N/D' });
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Sessione: null | { type:'negozio', polo:{...} } | { type:'area_manager' }
    const [session, setSession] = React.useState(() => {
        try { return JSON.parse(localStorage.getItem('visionottica_session')); } catch { return null; }
    });
    // Schermata di avvio: 'choice' | 'negozio_setup' | 'am_login'
    const [startupView, setStartupView] = React.useState('choice');
    // Polo attivo per area manager (runtime, non persistito)
    const [amActivePolo, setAmActivePolo] = React.useState(null);
    const [refreshTrigger, setRefreshTrigger] = React.useState(0);
    const [amSettings, setAmSettings] = React.useState(() => {
        try { return { ...AM_SETTINGS_DEFAULT, ...JSON.parse(localStorage.getItem(AM_SETTINGS_KEY)) }; }
        catch { return AM_SETTINGS_DEFAULT; }
    });

    const handleAmSettingsChange = (next) => {
        setAmSettings(next);
        localStorage.setItem(AM_SETTINGS_KEY, JSON.stringify(next));
    };

    // Caricamento dati da Firestore (hooks sempre chiamati, dati vuoti se nessun userId)
    const vendite = useFirestoreCollection('vendite', isAuthReady, refreshTrigger);
    const venditori = useFirestoreCollection('venditori', isAuthReady, refreshTrigger);
    const emailAmministrazioni = useFirestoreCollection('emailAmministrazioni', isAuthReady, refreshTrigger);
    const datiMensiliRaw = useFirestoreCollection('datiMensili', isAuthReady, refreshTrigger);
    const riparazioni = useFirestoreCollection('riparazioni', isAuthReady, refreshTrigger);
    const contatti = useFirestoreCollection('contatti_lenti', isAuthReady, refreshTrigger, { orderBy: 'cliente' });

    // Polo correntemente visualizzato nella console
    const activePolo = session?.type === 'negozio' ? session.polo : amActivePolo;

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

    // Ripristina il userId al riavvio se c'è una sessione negozio salvata
    React.useEffect(() => {
        if (!isAuthReady) return;
        if (session?.type === 'negozio' && session.polo?.userId) {
            window.mioCodiceUtente = session.polo.userId;
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

    const handleNegozioSetupComplete = (polo) => {
        const newSession = { type: 'negozio', polo };
        localStorage.setItem('visionottica_session', JSON.stringify(newSession));
        window.mioCodiceUtente = polo.userId;
        setSession(newSession);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleAreaManagerLogin = () => {
        const newSession = { type: 'area_manager' };
        localStorage.setItem('visionottica_session', JSON.stringify(newSession));
        setSession(newSession);
    };

    const handleAreaManagerSelectPolo = (polo) => {
        window.mioCodiceUtente = polo.userId;
        setAmActivePolo(polo);
        setActiveSection('dashboard');
        setRefreshTrigger(prev => prev + 1);
    };

    const handleLogout = () => {
        localStorage.removeItem('visionottica_session');
        window.mioCodiceUtente = '';
        setSession(null);
        setAmActivePolo(null);
        setStartupView('choice');
    };

    const handleNavigation = (section, subView = null) => {
        setActiveSection(section);
        setActiveSubView(subView);
        setIsSidebarOpen(false);
    };

    const renderSection = () => {
        const settings = isAreaManager ? amSettings : {};
        switch (activeSection) {
            case 'dashboard': return <Dashboard vendite={vendite} riparazioni={riparazioni} obiettivi={obiettivi} onNavigate={handleNavigation} amSettings={settings} />;
            case 'amministrazione': return <Amministrazione venditori={venditori} emailAmministrazioni={emailAmministrazioni} vendite={vendite} datiMensiliRaw={datiMensiliRaw} selectedPolo={activePolo} amSettings={settings} isAreaManager={isAreaManager} />;
            case 'laboratorio': return <Laboratorio vendite={vendite} venditori={venditori} riparazioni={riparazioni} contatti={contatti} initialSubView={activeSubView || 'ricerca'} />;
            case 'contattologia': return <Contattologia contatti={contatti} initialAction={activeSubView} onActionComplete={() => setActiveSubView(null)} />;
            default: return <Dashboard vendite={vendite} riparazioni={riparazioni} obiettivi={obiettivi} onNavigate={handleNavigation} amSettings={settings} />;
        }
    };

    const SidebarButton = ({ section, label, icon: Icon }) => (
        <button onClick={() => handleNavigation(section)} className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${activeSection === section ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-200'}`}>
            <Icon size={20} className="mr-3" />
            <span className="font-semibold">{label}</span>
        </button>
    );

    // ── Schermata di caricamento ──
    if (!isAuthReady) {
        return (
            <div className="h-screen w-screen flex justify-center items-center bg-gray-100">
                <div className="text-center">
                    <p className="text-xl font-semibold">Caricamento...</p>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mt-4"></div>
                </div>
            </div>
        );
    }

    // ── Nessuna sessione → schermata di avvio ──
    if (!session) {
        if (startupView === 'negozio_setup')
            return <NegozioSetup firebaseUid={user?.uid} onBack={() => setStartupView('choice')} onComplete={handleNegozioSetupComplete} />;
        if (startupView === 'am_login')
            return <AreaManagerLogin onBack={() => setStartupView('choice')} onSuccess={handleAreaManagerLogin} />;
        return <StartupScreen onNegozio={() => setStartupView('negozio_setup')} onAreaManager={() => setStartupView('am_login')} />;
    }

    // ── Area manager senza polo selezionato → lista polos ──
    if (session.type === 'area_manager' && !amActivePolo) {
        return <AreaManagerHome onSelectPolo={handleAreaManagerSelectPolo} onLogout={handleLogout} amSettings={amSettings} onSettingsChange={handleAmSettingsChange} />;
    }

    // ── Console principale (negozio o area manager che ha selezionato un polo) ──
    const isAreaManager = session.type === 'area_manager';

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

            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
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
                    <button className="md:hidden text-gray-500 hover:text-gray-800 p-1" onClick={() => setIsSidebarOpen(false)}>
                        <X size={22} />
                    </button>
                </div>

                <nav className="flex flex-col gap-2">
                    <SidebarButton section="dashboard" label="Dashboard" icon={LayoutDashboard} />
                    <SidebarButton section="amministrazione" label="Amministrazione" icon={Settings} />
                    {(!isAreaManager || amSettings.showLaboratorio) && (
                        <SidebarButton section="laboratorio" label="Laboratorio" icon={FlaskConical} />
                    )}
                    {(!isAreaManager || amSettings.showContattologia) && (
                        <SidebarButton section="contattologia" label="Contattologia" icon={Contact} />
                    )}
                </nav>

                <div className="mt-auto bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-bold text-blue-800 mb-2 text-lg">Obiettivo Giornaliero</h3>
                    <p className="text-sm text-gray-700"><strong>Data:</strong> {new Date().toLocaleDateString('it-IT')}</p>
                    <p className="text-sm text-gray-700"><strong>TGT Fatturato:</strong> <span className="font-bold">{obiettivi.budget}</span></p>
                    <p className="text-sm text-gray-700"><strong>TGT WO:</strong> <span className="font-bold">{obiettivi.wo}{obiettivi.wo !== 'N/D' && ' €'}</span></p>
                </div>

                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Console Attiva</p>
                        {isAreaManager && (
                            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">AM</span>
                        )}
                    </div>
                    <p className="text-2xl font-black text-blue-700">{activePolo?.codice}</p>
                    <p className="text-sm text-gray-600 mb-3">{activePolo?.nome}</p>

                    {isAreaManager ? (
                        <button
                            onClick={() => { setAmActivePolo(null); window.mioCodiceUtente = ''; }}
                            className="w-full flex items-center justify-center gap-2 text-xs py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50">
                            <ChevronLeft size={14} /> Torna alla lista
                        </button>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 text-xs py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-100">
                            <LogOut size={14} /> Esci
                        </button>
                    )}
                </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="md:hidden flex items-center gap-3 bg-white shadow-sm px-4 py-3 flex-shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-gray-700 hover:text-gray-900">
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
