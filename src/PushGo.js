// ===================================================================================
// --- MODULO PUSH&GO (integrazione OrdinaLac) ---
// L'ottico genera il QR cliente e gestisce gli ordini lenti a contatto
// direttamente dalla console. Si appoggia al progetto Firebase `ordinalac`
// tramite una seconda app Firebase ('pushgo') con login email/password ottico
// (le stesse credenziali del portale https://ordinalac.web.app/dashboard).
// ===================================================================================

import React from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import {
    getFirestore, collection, doc, getDoc, onSnapshot, query, where,
    updateDoc, deleteDoc
} from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { ExternalLink, LogOut, Printer, QrCode, Trash2, MessageCircle, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, TabButton, useConfirmation } from './Contattologia';

const PUSHGO_URL = 'https://ordinalac.web.app';

// --- App Firebase secondaria (progetto ordinalac) ---
const pgApp = getApps().find(a => a.name === 'pushgo') || initializeApp({
    apiKey: "AIzaSyDMRWXipp7VCMQiezOZSSZAhSQo8MWVgKs",
    authDomain: "ordinalac.firebaseapp.com",
    projectId: "ordinalac",
    storageBucket: "ordinalac.firebasestorage.app",
    messagingSenderId: "642877461161",
    appId: "1:642877461161:web:6a4d979e7a7ddd56140fb8"
}, 'pushgo');
const pgAuth = getAuth(pgApp);
const pgDb = getFirestore(pgApp);

// --- Range diottrici di produzione (catalogs/master → ranges) ---
// Stessa logica di ordinalac-react/src/lib/lensRanges.js
const getRange = (ranges, manufacturer, model, type) =>
    (ranges && manufacturer && model && type) ? ranges[`${manufacturer}::${model}::${type}`] || null : null;

const signed = v => (v > 0 ? '+' : '') + v.toFixed(2);
const quarter = v => Math.round(v * 4) / 4;

const pwrOptions = (range) => {
    const r = range?.pwr;
    if (!r || r.min == null || r.max == null) return null;
    const out = [];
    for (let v = r.min; v <= r.max + 1e-6; v += (v < -6 || v >= 6 ? 0.5 : 0.25)) out.push(signed(quarter(v)));
    return out;
};
const cylOptions = (range) => {
    const r = range?.cyl;
    if (!r || r.min == null || r.max == null) return null;
    const out = [];
    for (let v = r.min; v <= r.max + 1e-6; v += 0.5) out.push(signed(quarter(v)));
    return out;
};
const axisOptions = (range) => {
    const r = range?.axis;
    if (!r || r.min == null || r.max == null) return null;
    const out = [];
    for (let v = r.min; v <= r.max + 1e-6; v += 10) out.push(String(Math.round(v)));
    return out;
};
const addOptions = (range) => {
    const r = range?.add;
    if (!r) return null;
    if (r.values) return r.values;
    if (r.min == null || r.max == null) return null;
    const out = [];
    for (let v = r.min; v <= r.max + 1e-6; v += 0.25) out.push(signed(quarter(v)));
    return out;
};

const STATUS = {
    new:        { label: 'Nuovo',       cls: 'bg-blue-100 text-blue-800' },
    processing: { label: 'In Lav.',     cls: 'bg-yellow-100 text-yellow-800' },
    ready:      { label: 'Pronto',      cls: 'bg-green-100 text-green-800' },
    completed:  { label: 'Consegnato',  cls: 'bg-gray-100 text-gray-600' },
    cancelled:  { label: 'Annullato',   cls: 'bg-red-100 text-red-800' },
};

// md = modello OD (e legacy per app vecchie), mdos = modello OS
function buildQrUrl(uid, form, od, os, manufacturer) {
    const p = new URLSearchParams({
        oid: uid,
        n: form.name, ph: form.phone, e: form.email, cf: form.cf,
        sa: form.street, sc: form.city, sz: form.cap, sp: form.prov,
        m: manufacturer, md: od.model, mdos: os.model,
        tod: od.type, pod: od.pwr, cod: od.cyl, aod: od.axis, addod: od.add,
        tos: os.type, pos: os.pwr, cos: os.cyl, aos: os.axis, addos: os.add,
    });
    return `${PUSHGO_URL}/?${p.toString()}`;
}

const fmtEur = n => '€ ' + Number(n).toFixed(2).replace('.', ',');
const hasPrice = p => Number.isFinite(Number(p)) && Number(p) > 0;

// Riga occhio nella card ordine: modello → tipo/diottrie → quantità → prezzo
const EyeOrderRow = ({ label, color, eye, fallbackModel }) => {
    if (!eye) return null;
    const params = [eye.type, eye.pwr && `SF:${eye.pwr}`, eye.cyl && `CYL:${eye.cyl}`, eye.axis && `AX:${eye.axis}`, eye.add && `ADD:${eye.add}`].filter(Boolean).join(' · ');
    return (
        <div className="border-b border-gray-200 pb-1.5 last:border-b-0">
            <div className="flex items-center gap-2">
                <span className={`font-bold ${color} text-xs w-6 flex-shrink-0`}>{label}</span>
                <span className="flex-1 text-xs font-semibold text-gray-800 truncate">{eye.model || fallbackModel || '—'}</span>
                <span className="font-bold bg-white border px-1 rounded text-xs flex-shrink-0">{eye.qty || 1} pz</span>
                {hasPrice(eye.price) && <span className="font-bold text-blue-700 text-xs w-16 text-right flex-shrink-0">{fmtEur(eye.price)}</span>}
            </div>
            <p className="pl-8 mt-0.5 text-xs text-gray-600">{params || '—'}</p>
        </div>
    );
};

// Stampa ordine (stesso layout del portale)
function printOrder(order) {
    const l = order.lens_order || {};
    const eurRow = p => hasPrice(p) ? fmtEur(p) : '-';
    const w = window.open('', '_blank', 'height=600,width=800');
    w.document.write(`<html><head><title>Ordine - ${order.patient_name}</title>
        <style>body{font-family:sans-serif;padding:20px;} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:8px;}</style>
        </head><body>
        <h2>Ordine Lenti — ${order.patient_name}</h2>
        <p><b>Produttore:</b> ${l.manufacturer || '-'}</p>
        <table><tr><th>Occhio</th><th>Modello</th><th>Tipo</th><th>PWR</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>Qty</th><th>Prezzo</th></tr>
        <tr><td>OD</td><td>${l.od?.model||l.model||'-'}</td><td>${l.od?.type||'-'}</td><td>${l.od?.pwr||'-'}</td><td>${l.od?.cyl||'-'}</td><td>${l.od?.axis||'-'}</td><td>${l.od?.add||'-'}</td><td>${l.od?.qty||1}</td><td>${eurRow(l.od?.price)}</td></tr>
        <tr><td>OS</td><td>${l.os?.model||l.model||'-'}</td><td>${l.os?.type||'-'}</td><td>${l.os?.pwr||'-'}</td><td>${l.os?.cyl||'-'}</td><td>${l.os?.axis||'-'}</td><td>${l.os?.add||'-'}</td><td>${l.os?.qty||1}</td><td>${eurRow(l.os?.price)}</td></tr>
        </table>
        ${l.total != null ? `<p style="text-align:right;font-size:16px"><b>TOTALE: ${fmtEur(l.total)}</b></p>` : ''}
        <p><b>Consegna:</b> ${order.delivery?.mode === 'delivery' ? order.delivery?.address_full : 'Ritiro in negozio'}</p>
        <script>window.print();window.close();<\\/script></body></html>`);
    w.document.close();
}

// Campo parametro: select vincolato ai valori di produzione, altrimenti input libero
const ParamField = ({ value, onChange, options, placeholder }) => {
    if (!options || options.length === 0) return (
        <Input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    );
    const extra = value && !options.includes(value) ? value : null;
    return (
        <Select value={value} onChange={e => onChange(e.target.value)}>
            <option value="">-- {placeholder} --</option>
            {extra && <option value={extra}>{extra} (fuori produzione)</option>}
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
    );
};

const EMPTY_EYE = { model: '', type: '', pwr: '', cyl: '', axis: '', add: '' };

const LensEyeForm = ({ label, color, lensData, ranges, manufacturer, value, onChange }) => {
    const models = lensData && manufacturer ? Object.keys(lensData[manufacturer] || {}) : [];
    const types = lensData && manufacturer && value.model ? lensData[manufacturer]?.[value.model] || [] : [];
    const t = (value.type || '').toLowerCase();
    const showPwr  = t && !t.includes('nessun');
    const showCyl  = t.includes('astigmatismo') || t.includes('toric') || t.includes('xr');
    const showAdd  = t.includes('multifocal') || t.includes('presbiopia');
    const range = getRange(ranges, manufacturer, value.model, value.type);

    return (
        <div className={`relative border ${color === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'} rounded-xl p-4`}>
            <div className={`absolute -top-3 left-4 ${color === 'blue' ? 'bg-blue-600' : 'bg-green-600'} text-white text-xs font-bold px-2 py-1 rounded shadow-sm`}>
                {label}
            </div>
            <div className="mt-2 space-y-2">
                <Select value={value.model} disabled={!manufacturer}
                    onChange={e => onChange({ model: e.target.value, type: '', pwr: '', cyl: '', axis: '', add: '' })}>
                    <option value="">-- Modello Lente --</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Select value={value.type} disabled={!value.model}
                    onChange={e => onChange({ type: e.target.value, pwr: '', cyl: '', axis: '', add: '' })}>
                    <option value="">-- Tipo Lente --</option>
                    {types.map(ty => <option key={ty} value={ty}>{ty}</option>)}
                </Select>
                {value.type && (
                    <div className="grid grid-cols-2 gap-2">
                        {showPwr && <div className="col-span-2"><ParamField placeholder="PWR (Sfera)" value={value.pwr} options={pwrOptions(range)} onChange={v => onChange({ pwr: v })} /></div>}
                        {showCyl && <ParamField placeholder="CYL" value={value.cyl} options={cylOptions(range)} onChange={v => onChange({ cyl: v })} />}
                        {showCyl && <ParamField placeholder="AXIS" value={value.axis} options={axisOptions(range)} onChange={v => onChange({ axis: v })} />}
                        {showAdd && <div className="col-span-2"><ParamField placeholder="ADD" value={value.add} options={addOptions(range)} onChange={v => onChange({ add: v })} /></div>}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Login ottico Push&Go ---
const PushGoLogin = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await signInWithEmailAndPassword(pgAuth, email, password);
            toast.success('Accesso Push&Go effettuato!');
        } catch {
            toast.error('Credenziali non valide. Usa le credenziali del portale Push&Go.');
        }
        setBusy(false);
    };

    return (
        <div className="max-w-sm mx-auto text-center py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-cyan-100 rounded-full mb-4">
                <QrCode className="text-cyan-600" size={28} />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900">Push&Go</h3>
            <p className="text-sm text-cyan-700 font-medium mb-1">L'ordine delle lenti a contatto, con un click</p>
            <p className="text-sm text-gray-500 mb-6">Accedi con le credenziali del portale ottico.</p>
            <form onSubmit={handleLogin} className="space-y-3 text-left">
                <Input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <Input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <Button type="submit" isLoading={busy} className="w-full">Accedi</Button>
            </form>
            <a href={`${PUSHGO_URL}/register`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-4">
                Non hai un account? Registrati sul portale <ExternalLink size={14} />
            </a>
        </div>
    );
};

// --- Pannello ordini + QR ---
const PushGoPanel = ({ user }) => {
    const [tab, setTab] = React.useState('ordini');
    const [orders, setOrders] = React.useState([]);
    const [lensData, setLensData] = React.useState({});
    const [ranges, setRanges] = React.useState({});
    const [supplyOrder, setSupplyOrder] = React.useState(null); // ordine per cui scegliere la fornitura
    const [ConfirmationDialog, requestConfirmation] = useConfirmation('Elimina ordine');

    React.useEffect(() => {
        const q = query(collection(pgDb, 'orders'), where('optician_id', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setOrders(items);
        }, () => toast.error('Errore nel caricamento ordini Push&Go'));
        return unsub;
    }, [user.uid]);

    React.useEffect(() => {
        getDoc(doc(pgDb, 'optician_config', user.uid, 'lenses', 'main'))
            .then(s => { if (s.exists()) setLensData(s.data().data || {}); })
            .catch(() => {});
        getDoc(doc(pgDb, 'catalogs', 'master'))
            .then(s => { if (s.exists()) setRanges(s.data().ranges || {}); })
            .catch(() => {});
    }, [user.uid]);

    const changeStatus = async (order, status) => {
        try {
            await updateDoc(doc(pgDb, 'orders', order.id), { status });
            toast.success(`Ordine di ${order.patient_name}: ${STATUS[status]?.label || status}`);
        } catch {
            toast.error('Errore nel cambio stato.');
        }
    };

    const notifyWhatsApp = (order) => {
        const phone = order.client_info?.phone;
        if (!phone) { toast.error('Nessun telefono per questo cliente.'); return; }
        let p = phone.replace(/[^0-9]/g, '');
        if (!p.startsWith('39')) p = '39' + p;
        const body = order.status === 'ready'
            ? `Ciao ${order.patient_name || ''}, le tue lenti sono pronte! Ti aspettiamo.`
            : `Ciao ${order.patient_name || ''}, abbiamo preso in carico il tuo ordine.`;
        window.open(`https://wa.me/${p}?text=${encodeURIComponent(body)}`, '_blank');
    };

    const deleteOrder = (order) => requestConfirmation(
        `Eliminare l'ordine di ${order.patient_name}?`,
        async () => {
            try { await deleteDoc(doc(pgDb, 'orders', order.id)); toast.success('Ordine eliminato.'); }
            catch { toast.error('Errore durante l\'eliminazione.'); }
        }
    );

    const requestSupply = async (order, destination) => {
        try {
            await updateDoc(doc(pgDb, 'orders', order.id), {
                supply_request: { status: 'pending', destination, requested_at: new Date() }
            });
            toast.success('Richiesta fornitura inviata!');
        } catch {
            toast.error('Errore nella richiesta fornitura.');
        }
        setSupplyOrder(null);
    };

    return (
        <div>
            <ConfirmationDialog />
            <div className="flex justify-between items-center mb-4">
                <div className="flex border-b flex-1">
                    <TabButton tabName="ordini" label={`Ordini (${orders.filter(o => o.status === 'new').length} nuovi)`} activeTab={tab} setActiveTab={setTab} />
                    <TabButton tabName="qr" label="Nuovo Cliente / QR" activeTab={tab} setActiveTab={setTab} />
                </div>
                <div className="flex items-center gap-3 pl-4">
                    <a href={`${PUSHGO_URL}/dashboard`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                        Portale <ExternalLink size={14} />
                    </a>
                    <button onClick={() => signOut(pgAuth)} title={`Esci (${user.email})`}
                        className="text-gray-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
                </div>
            </div>

            {tab === 'ordini' && (
                <div className="space-y-3">
                    {orders.length === 0 && (
                        <div className="text-center text-gray-500 py-10">
                            <ClipboardList className="mx-auto mb-2 text-gray-300" size={40} />
                            Nessun ordine Push&Go ricevuto.
                        </div>
                    )}
                    {orders.map(o => {
                        const st = STATUS[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-600' };
                        const date = o.timestamp?.toDate ? o.timestamp.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                        const l = o.lens_order;
                        const hasSupply = o.supply_request?.status === 'pending';
                        const supplyDest = o.supply_request?.destination;
                        return (
                            <div key={o.id} className="bg-gray-50 border rounded-lg p-4 shadow-sm">
                                <div className="flex flex-wrap justify-between items-start gap-3">
                                    <div className="flex-1 min-w-[280px]">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-lg text-gray-800">{o.patient_name || 'Cliente'}</p>
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${st.cls}`}>{st.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{date} · {o.delivery?.mode === 'delivery' ? `Consegna: ${o.delivery?.address_full || ''}` : 'Ritiro in negozio'}</p>
                                        {o.client_info?.phone && <p className="text-xs text-gray-500">📞 {o.client_info.phone}</p>}
                                        {l && (
                                            <div className="bg-white border rounded-lg p-3 mt-2 text-sm">
                                                <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
                                                    <span className="font-bold text-gray-800">{l.manufacturer}</span>
                                                    {hasSupply
                                                        ? <span className={`px-2 py-1 rounded text-xs font-bold ${supplyDest === 'client' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {supplyDest === 'client' ? '🟣 Fornitura: CLIENTE' : '🟠 Fornitura: NEGOZIO'}
                                                        </span>
                                                        : o.status !== 'cancelled' && o.status !== 'completed' && (
                                                            <button onClick={() => setSupplyOrder(o)}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold transition">
                                                                📦 Ordina al Fornitore
                                                            </button>
                                                        )
                                                    }
                                                </div>
                                                <div className="space-y-1.5">
                                                    <EyeOrderRow label="OD" color="text-blue-600"  eye={l.od} fallbackModel={l.model} />
                                                    <EyeOrderRow label="OS" color="text-green-600" eye={l.os} fallbackModel={l.model} />
                                                </div>
                                                {l.total != null && (
                                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                                                        <span className="font-bold text-gray-700 text-xs uppercase">Totale</span>
                                                        <span className="font-bold text-blue-700">{fmtEur(l.total)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select value={o.status} onChange={e => changeStatus(o, e.target.value)}>
                                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </Select>
                                        <button onClick={() => notifyWhatsApp(o)} title="Notifica WhatsApp"
                                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg"><MessageCircle size={18} /></button>
                                        <button onClick={() => printOrder(o)} title="Stampa ordine"
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Printer size={18} /></button>
                                        <button onClick={() => deleteOrder(o)} title="Elimina"
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Modal scelta destinazione fornitura */}
                    {supplyOrder && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border-t-4 border-indigo-500">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Richiesta Fornitura Lenti</h3>
                                <p className="text-sm text-gray-600 mb-6">Seleziona la destinazione per <b>{supplyOrder.patient_name}</b>.</p>
                                <div className="space-y-3">
                                    {supplyOrder.delivery?.mode === 'delivery' && (
                                        <button onClick={() => requestSupply(supplyOrder, 'client')}
                                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg">
                                            Spedisci al Cliente (Drop-shipping)
                                        </button>
                                    )}
                                    <button onClick={() => requestSupply(supplyOrder, 'store')}
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">
                                        Spedisci al Negozio
                                    </button>
                                    <button onClick={() => setSupplyOrder(null)}
                                        className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200">
                                        Annulla
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === 'qr' && <QrGenerator uid={user.uid} lensData={lensData} ranges={ranges} />}
        </div>
    );
};

// --- Generatore QR (scheda cliente + prescrizione) ---
const QrGenerator = ({ uid, lensData, ranges }) => {
    const [form, setForm] = React.useState({ name: '', cf: '', email: '', phone: '', street: '', city: '', cap: '', prov: '' });
    const [manuf, setManuf] = React.useState(''); // produttore comune; modello per occhio in od/os
    const [od, setOd] = React.useState(EMPTY_EYE);
    const [os, setOs] = React.useState(EMPTY_EYE);
    const [qrUrl, setQrUrl] = React.useState('');
    const qrRef = React.useRef(null);

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: key === 'cf' || key === 'prov' ? e.target.value.toUpperCase() : e.target.value }));

    const generate = () => setQrUrl(buildQrUrl(uid, form, od, os, manuf));

    const printQR = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        const w = window.open('', '_blank', 'width=400,height=520');
        w.document.write(`<!DOCTYPE html><html><head><title>QR – ${form.name}</title>
            <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff;}
            h2{margin:0 0 4px;font-size:18px;} p{margin:0 0 16px;color:#555;font-size:13px;} img{border:1px solid #eee;padding:8px;border-radius:8px;}</style>
            </head><body>
            <h2>${form.name}</h2>
            <p>${manuf} ${od.model === os.model ? od.model : `OD: ${od.model} / OS: ${os.model}`} — Push&amp;Go</p>
            <img src="${dataUrl}" width="220" height="220" />
            <script>window.onload=function(){window.print();window.close();}<\\/script>
            </body></html>`);
        w.document.close();
    };

    if (qrUrl) return (
        <div className="text-center py-6">
            <h4 className="text-xl font-bold text-gray-800 mb-1">QR di {form.name}</h4>
            <p className="text-sm text-gray-500 mb-4">Il cliente lo scansiona per installare Push&Go e ordinare le lenti.</p>
            <div ref={qrRef} className="inline-block bg-white border rounded-xl p-4 shadow-sm">
                <QRCodeCanvas value={qrUrl} size={220} />
            </div>
            <div className="flex justify-center gap-3 mt-6">
                <Button onClick={printQR} icon={Printer} variant="slate">Stampa</Button>
                <Button onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('Link copiato!'); }} variant="teal">Copia link</Button>
                <Button onClick={() => setQrUrl('')} variant="neutral">Nuovo QR</Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="text-sm font-bold text-cyan-700 uppercase tracking-wide mb-3">① Dati Cliente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-gray-500">Nome e Cognome</label><Input value={form.name} onChange={set('name')} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Codice Fiscale</label><Input value={form.cf} onChange={set('cf')} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Email</label><Input type="email" value={form.email} onChange={set('email')} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Telefono</label><Input type="tel" value={form.phone} onChange={set('phone')} /></div>
                </div>
            </div>
            <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="text-sm font-bold text-cyan-700 uppercase tracking-wide mb-3">② Indirizzo di Spedizione</h4>
                <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-6"><label className="text-xs font-bold text-gray-500">Via / Piazza e Civico</label><Input value={form.street} onChange={set('street')} placeholder="Via Roma 1" /></div>
                    <div className="col-span-3"><label className="text-xs font-bold text-gray-500">Città</label><Input value={form.city} onChange={set('city')} /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-gray-500">CAP</label><Input value={form.cap} onChange={set('cap')} /></div>
                    <div className="col-span-1"><label className="text-xs font-bold text-gray-500">Prov</label><Input value={form.prov} maxLength={2} onChange={set('prov')} /></div>
                </div>
            </div>
            <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="text-sm font-bold text-cyan-700 uppercase tracking-wide mb-3">③ Prescrizione Lenti</h4>
                {Object.keys(lensData).length === 0 && (
                    <p className="text-sm text-orange-600 mb-3">
                        Listino vuoto: abilita le lenti dal portale Push&Go (tab "Listino & Prezzi").
                    </p>
                )}
                <div className="mb-5">
                    <label className="text-xs font-bold text-gray-500">Produttore (comune ai due occhi)</label>
                    <Select value={manuf} onChange={e => { setManuf(e.target.value); setOd(EMPTY_EYE); setOs(EMPTY_EYE); }}>
                        <option value="">-- Seleziona --</option>
                        {Object.keys(lensData).map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                    <p className="text-xs text-gray-400 mt-1">Il modello lente si sceglie per ciascun occhio qui sotto (può essere diverso tra OD e OS).</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    <LensEyeForm label="OCCHIO DESTRO (OD)" color="blue" lensData={lensData} ranges={ranges}
                        manufacturer={manuf} value={od} onChange={vals => setOd(o => ({ ...o, ...vals }))} />
                    <LensEyeForm label="OCCHIO SINISTRO (OS)" color="green" lensData={lensData} ranges={ranges}
                        manufacturer={manuf} value={os} onChange={vals => setOs(o => ({ ...o, ...vals }))} />
                </div>
            </div>
            <div className="flex justify-end">
                <Button onClick={generate} icon={QrCode} disabled={!form.name || !manuf || !od.model || !os.model}>Genera QR</Button>
            </div>
        </div>
    );
};

// --- Componente principale ---
const PushGo = () => {
    const [user, setUser] = React.useState(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        const unsub = onAuthStateChanged(pgAuth, u => {
            setUser(u && !u.isAnonymous ? u : null);
            setReady(true);
        });
        return unsub;
    }, []);

    if (!ready) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
        </div>
    );
    return user ? <PushGoPanel user={user} /> : <PushGoLogin />;
};

export default PushGo;
