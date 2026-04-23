/* global XLSX, jspdf */
// ===================================================================================
// --- MODULO: AMMINISTRAZIONE ---
// Contiene: componenti di statistica (Podio, VistaGraficiCompetizione,
// StatisticheAvanzate, StatisticheVendite, AnalisiVisiva), modali amministrative
// (InviaDatiCassettoModal, GestioneDatiModal) e le viste della sezione
// Amministrazione (DatiMensili, InvioChiusura, FiltraPdf, Amministrazione).
// ===================================================================================

import React from 'react';
import {
    doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot,
    collection, query, orderBy, writeBatch, getDocs
} from 'firebase/firestore';
import {
    Trash2, PlusCircle, ChevronLeft, Send, Calendar, Filter, Download, Archive,
    Eye, Clock, FileDown, Trophy, Medal, DollarSign, Glasses, ShieldCheck,
    BarChartHorizontal, Settings
} from 'lucide-react';

// --- GRAFICI E NOTIFICHE ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import toast from 'react-hot-toast';

// Importa utilities e componenti UI condivisi dal file Contattologia
import {
    db, auth, appId,
    getCollectionRef, getDocumentRef,
    useConfirmation, generateSalesPdf,
    Modal, AlertModal, Button, Input, Select, TextArea, StatCard, TabButton
} from './Contattologia';

// --- REGISTRAZIONE COMPONENTI CHART.JS ---
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, ChartDataLabels);


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
        <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-700 text-sm w-full sm:w-auto">Periodo:</h3>
                    <Button onClick={() => setPeriodo('giornaliero')} variant={periodo === 'giornaliero' ? 'primary' : 'neutral'} className="flex-1 sm:flex-none">Giornaliero</Button>
                    <Button onClick={() => setPeriodo('mensile')} variant={periodo === 'mensile' ? 'primary' : 'neutral'} className="flex-1 sm:flex-none">Mese Corrente</Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-700 text-sm w-full sm:w-auto">Classifica:</h3>
                    <Button onClick={() => setMetrica('fatturato')} icon={DollarSign} variant={metrica === 'fatturato' ? 'success' : 'neutral'} className="flex-1 sm:flex-none">Fatturato</Button>
                    <Button onClick={() => setMetrica('secondi')} icon={Glasses} variant={metrica === 'secondi' ? 'success' : 'neutral'} className="flex-1 sm:flex-none">Secondi</Button>
                    <Button onClick={() => setMetrica('sos')} icon={ShieldCheck} variant={metrica === 'sos' ? 'success' : 'neutral'} className="flex-1 sm:flex-none">SOS</Button>
                </div>
            </div>
            {renderPodio()}
        </div>
    );
};

const StatisticheAvanzate = ({ vendite, venditori }) => {
    const [view, setView] = React.useState('competizione'); // competizione, analisi, testo

    return (
        <div>
            <div className="flex overflow-x-auto border-b mb-4 gap-1 pb-0">
                <TabButton tabName="competizione" label="Competizione" activeTab={view} setActiveTab={setView} />
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
    
    // --- NUOVO: State per le esclusioni dal calcolo della media ---
    const [esclusioni, setEsclusioni] = React.useState({
        escludiSos: false,
        escludiPrimi: false,
        escludiSecondi: false,
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFiltri(prev => ({ ...prev, [name]: value }));
    };
    
    // --- NUOVO: Handler per i checkbox di esclusione ---
    const handleEsclusioniChange = (e) => {
        const { name, checked } = e.target;
        setEsclusioni(prev => ({ ...prev, [name]: checked }));
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
        // --- MODIFICA: Applica i filtri di esclusione solo per il calcolo della media ---
        const datiPerMedia = datiFiltrati.filter(v => {
            if (esclusioni.escludiSos && (v.trattamenti || []).includes('Utilizzo SOS')) {
                return false;
            }
            if (esclusioni.escludiPrimi && v.ordine_lente === 'Primo') {
                return false;
            }
            if (esclusioni.escludiSecondi && v.ordine_lente === 'Secondo') {
                return false;
            }
            return true;
        });

        // I calcoli generali (totale, conteggio) si basano sui dati filtrati per data/venditore
        const totale = datiFiltrati.reduce((acc, v) => acc + (v.importo || 0), 0);
        const count = datiFiltrati.length;

        // Il calcolo della media si basa sui dati ulteriormente filtrati dalle esclusioni
        const totalePerMedia = datiPerMedia.reduce((acc, v) => acc + (v.importo || 0), 0);
        const countPerMedia = datiPerMedia.length;
        const media = countPerMedia > 0 ? totalePerMedia / countPerMedia : 0;
        
        // I dati per i grafici (primi/secondi, trattamenti) usano i dati filtrati originali
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
    }, [datiFiltrati, esclusioni]); // Aggiunta dipendenza 'esclusioni'

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
                            {/* --- NUOVO: Sezione checkbox per esclusioni --- */}
                            <div className="bg-yellow-50 p-4 rounded-lg shadow-inner mt-6 border border-yellow-200">
                                <h4 className="text-md font-semibold mb-3 text-gray-800">Escludi dal calcolo del "Valore Medio Vendita"</h4>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" name="escludiSos" checked={esclusioni.escludiSos} onChange={handleEsclusioniChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2" />
                                        Escludi "Utilizzo SOS"
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" name="escludiPrimi" checked={esclusioni.escludiPrimi} onChange={handleEsclusioniChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2" />
                                        Escludi "Primo Occhiale"
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" name="escludiSecondi" checked={esclusioni.escludiSecondi} onChange={handleEsclusioniChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2" />
                                        Escludi "Secondo Occhiale"
                                    </label>
                                </div>
                            </div>
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
// --- MODALI AMMINISTRAZIONE ---
// ===================================================================================
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

        let body = `Riepilogo dati per cassetto fino al ${new Date(selectedDate).toLocaleDateString('it-IT')}:\n\n`;
        body += `ORDINI IN CORSO:\n`;
        body += `  - Totale Valore: ${calculatedData.inCorso.totale.toFixed(2)} €\n`;
        body += `  - Numero Schede: ${calculatedData.inCorso.count}\n\n`;
        body += `ORDINI PRONTI:\n`;
        body += `  - Totale Valore: ${calculatedData.pronti.totale.toFixed(2)} €\n`;
        body += `  - Numero Schede: ${calculatedData.pronti.count}\n\n`;
        body += `Cordiali Saluti,\nIl Sistema Gestionale`;

        const mailtoLink = `mailto:${selectedEmails.join(',')}?subject=Riepilogo Dati Cassetto&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
        toast.success("Email pronta nel client di posta!");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dati per Cassetto" size="max-w-3xl">
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

//// ===================================================================================
// --- SEZIONE AMMINISTRAZIONE (MODIFICATA) ---
// ===================================================================================
// ===================================================================================
// --- GESTIONE POLOS ---
// ===================================================================================

const GestionePolos = ({ onClose }) => {
    const [polos, setPolos] = React.useState([]);
    const [nuovoCodice, setNuovoCodice] = React.useState('');
    const [nuovoNome, setNuovoNome] = React.useState('');
    const [nuovoUserId, setNuovoUserId] = React.useState('');
    const [nuovoRuolo, setNuovoRuolo] = React.useState('negozio');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const q = query(collection(db, `artifacts/${appId}/polos`), orderBy('codice'));
        const unsub = onSnapshot(q, snap => {
            setPolos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {});
        return unsub;
    }, []);

    const handleAdd = async () => {
        const codice = nuovoCodice.trim();
        const nome = nuovoNome.trim();
        const userId = nuovoUserId.trim();
        if (!codice || !nome || !userId) { toast.error('Inserisci codice, nome e UserID.'); return; }
        setLoading(true);
        try {
            await addDoc(collection(db, `artifacts/${appId}/polos`), {
                codice, nome, userId, ruolo: nuovoRuolo, createdAt: new Date().toISOString()
            });
            setNuovoCodice(''); setNuovoNome(''); setNuovoUserId(''); setNuovoRuolo('negozio');
            toast.success(`Console "${codice}" aggiunta.`);
        } catch { toast.error('Errore durante il salvataggio.'); }
        setLoading(false);
    };

    const handleDelete = async (id, codice) => {
        if (!window.confirm(`Eliminare la console "${codice}"?`)) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/polos`, id));
            toast.success('Console eliminata.');
        } catch { toast.error('Errore durante l\'eliminazione.'); }
    };

    return (
        <div>
            <Button onClick={onClose} variant="neutral" className="mb-6" icon={ChevronLeft}>Torna al menu</Button>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Gestione Console (Polos)</h3>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">Aggiungi nuova console</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Codice polo</label>
                        <input value={nuovoCodice} onChange={e => setNuovoCodice(e.target.value)}
                            placeholder="es. 6061"
                            className="p-2 border rounded w-full font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Nome negozio</label>
                        <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)}
                            placeholder="es. VisionOttica Catania"
                            className="p-2 border rounded w-full text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 block mb-1">UserID Firebase</label>
                        <input value={nuovoUserId} onChange={e => setNuovoUserId(e.target.value)}
                            placeholder="es. 3e4qJDou5Rf38tOgFnmkBRcC3f63"
                            className="p-2 border rounded w-full text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Ruolo</label>
                        <select value={nuovoRuolo} onChange={e => setNuovoRuolo(e.target.value)}
                            className="p-2 border rounded w-full text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                            <option value="negozio">Negozio</option>
                            <option value="area_manager">Area Manager</option>
                        </select>
                    </div>
                </div>
                <Button onClick={handleAdd} variant="primary" icon={PlusCircle} disabled={loading}>
                    Aggiungi Console
                </Button>
            </div>

            <div className="space-y-2">
                {polos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Nessuna console configurata.</p>
                ) : polos.map(polo => (
                    <div key={polo.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                        <div>
                            <span className="font-black text-blue-700 text-xl mr-2">{polo.codice}</span>
                            <span className="text-gray-700 mr-2">{polo.nome}</span>
                            {polo.ruolo === 'area_manager' && (
                                <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Area Manager</span>
                            )}
                            <p className="text-xs text-gray-400 font-mono mt-1">{polo.userId}</p>
                        </div>
                        <Button onClick={() => handleDelete(polo.id, polo.codice)} variant="danger" icon={Trash2} className="text-xs py-1 px-3 ml-4 flex-shrink-0">
                            Elimina
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Amministrazione = ({ venditori, emailAmministrazioni, vendite, datiMensiliRaw, selectedPolo, amSettings = {}, isAreaManager = false }) => {
    const [subView, setSubView] = React.useState('menu');
    const [isGestioneModalOpen, setIsGestioneModalOpen] = React.useState(false);
    const [isCassettoModalOpen, setIsCassettoModalOpen] = React.useState(false);

    const datiChiusuraGiornaliera = React.useMemo(() => {
        const oggi = new Date();
        const periodYYYYMM = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
        const datiMeseCorrente = datiMensiliRaw.find(d => d.id === periodYYYYMM);

        const defaultValues = {
            saldatoTgt: 0, saldatoCy: 0, woTgt: 0, woCy: 0,
            deltaRollingSaldatoPrev: 0, deltaRollingWoPrev: 0,
            saldatoCyPrev: 0, woCyPrev: 0
        };

        if (!datiMeseCorrente) return defaultValues;

        const oggiStr = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
        const dayIndex = datiMeseCorrente.dateHeaders.findIndex(h => h === oggiStr);

        if (dayIndex === -1) return defaultValues;

        const getMetricRow = (name) => datiMeseCorrente.metrics.find(m => m.name.toLowerCase() === name.toLowerCase());
        
        const deltaRollingRows = datiMeseCorrente.metrics.filter(m => m.name.toLowerCase() === 'delta rolling');
        const deltaRollingSaldatoRow = deltaRollingRows[0];
        const deltaRollingWoRow = deltaRollingRows[1];

        const saldatoTgtRow = getMetricRow('saldato tgt');
        const woTgtRow = getMetricRow('wo tgt');
        const saldatoCyRow = getMetricRow('saldato cy');
        const woCyRow = getMetricRow('wo cy');
        
        const saldatoTgt = saldatoTgtRow?.values[dayIndex] || 0;
        const woTgt = woTgtRow?.values[dayIndex] || 0;

        let deltaRollingSaldatoPrev = 0;
        let deltaRollingWoPrev = 0;
        let saldatoCyPrev = 0;
        let woCyPrev = 0;

        if (dayIndex > 0) {
            const prevDayIndex = dayIndex - 1;
            deltaRollingSaldatoPrev = parseFloat(deltaRollingSaldatoRow?.values[prevDayIndex]) || 0;
            deltaRollingWoPrev = parseFloat(deltaRollingWoRow?.values[prevDayIndex]) || 0;
            saldatoCyPrev = saldatoCyRow?.values.slice(0, prevDayIndex + 1).reduce((acc, val) => acc + (parseFloat(val) || 0), 0) || 0;
            woCyPrev = woCyRow?.values.slice(0, prevDayIndex + 1).reduce((acc, val) => acc + (parseFloat(val) || 0), 0) || 0;
        }
        
        const saldatoCy = saldatoCyRow?.values.slice(0, dayIndex + 1).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        const woCy = woCyRow?.values.slice(0, dayIndex + 1).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        
        return {
            saldatoTgt, woTgt, saldatoCy, woCy,
            deltaRollingSaldatoPrev, deltaRollingWoPrev,
            saldatoCyPrev, woCyPrev
        };
    }, [datiMensiliRaw]);

    const subViewComponents = {
        datiMensili: <DatiMensili />,
        statistiche: <StatisticheAvanzate vendite={vendite} venditori={venditori} />,
        chiusura: <InvioChiusura vendite={vendite} emailAmministrazioni={emailAmministrazioni} onClose={() => setSubView('menu')} datiChiusuraGiornaliera={datiChiusuraGiornaliera} />,
        pdf: <FiltraPdf vendite={vendite} venditori={venditori} onClose={() => setSubView('menu')} />,
        gestionePolos: <GestionePolos onClose={() => setSubView('menu')} />,
    };

    const renderSubView = () => subViewComponents[subView] || <p>Sezione non trovata.</p>;

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button onClick={() => setSubView('datiMensili')} variant="primary" icon={Calendar}>Dati Mensili</Button>
            <Button onClick={() => setSubView('statistiche')} variant="indigo" icon={BarChartHorizontal}>Statistiche Veloci</Button>
            <Button onClick={() => setIsCassettoModalOpen(true)} variant="sky" icon={Send}>Dati per Cassetto</Button>
            {(!isAreaManager || amSettings.showChiusura) && (
                <Button onClick={() => setSubView('chiusura')} variant="success" icon={Send}>Invio Chiusura Giornaliera</Button>
            )}
            {(!isAreaManager || amSettings.showImpostazioni) && (
                <Button onClick={() => setIsGestioneModalOpen(true)} variant="neutral" icon={Settings}>Impostazioni</Button>
            )}
            <Button onClick={() => setSubView('pdf')} variant="warning" icon={Filter}>Reportistica Avanzata</Button>
            {isAreaManager && (
                <Button onClick={() => setSubView('gestionePolos')} variant="indigo" icon={PlusCircle}>Gestione Console (Polos)</Button>
            )}
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
        const userId = window.mioCodiceUtente || auth.currentUser?.uid;
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/datiMensili`, periodo);
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
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const sheetData = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

                    let dataStartRowIndex = -1;
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
                    const rowsToRead = 25; 
                    for (let i = dataStartRowIndex; i < dataStartRowIndex + rowsToRead && i < sheetData.length; i++) {
                        const row = sheetData[i] || [];
                        const metricName = String(row[3] || "").trim();
                        if (metricName || row.slice(4).some(cell => cell !== null)) {
                            const values = row.slice(4, 4 + numDaysInMonth);
                            metrics.push({ name: metricName, values: values.map(v => v === null ? '' : v) });
                        }
                    }

                    const parsedData = { period: periodo, dateHeaders, metrics };
                    const userId = window.mioCodiceUtente || auth.currentUser?.uid;
                    await setDoc(doc(db, `artifacts/${appId}/users/${userId}/datiMensili`, periodo), parsedData);
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

    const renderCellContent = (metricName, value) => {
        const isPercentage = metricName.toLowerCase() === 'saldato vs target';
        const isNumeric = typeof value === 'number';

        if (isPercentage && isNumeric) {
            return `${(value * 100).toFixed(0)}%`;
        }
        if (isNumeric) {
            return value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
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
                                {datiMensili.dateHeaders.map(h => <th key={h} className="py-2 px-3 border-b font-normal text-gray-600 w-24">{h.substring(0, 5)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {datiMensili.metrics.map((m, metricIndex) => {
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
                                            className={`
                                                py-2 px-3 border-b text-right
                                                ${(v === '' || v === null) ? 'bg-gray-200' : ''}
                                            `}
                                        >
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
        const deltaRollingSaldatoPrev = parseFloat(datiChiusuraGiornaliera?.deltaRollingSaldatoPrev) || 0;
        const deltaRollingWoPrev = parseFloat(datiChiusuraGiornaliera?.deltaRollingWoPrev) || 0;

        const woCy = datiOggi.sommario.totaleWO;
        const manualFatturatoValue = parseFloat(manualInputs.fatturato);
        const saldatoCy = !isNaN(manualFatturatoValue) ? manualFatturatoValue : 0; 

        const dailyDeltaSaldato = saldatoCy - saldatoTgt;
        const dailyDeltaWo = woCy - woTgt;

        const deltaRollingSaldato = deltaRollingSaldatoPrev + dailyDeltaSaldato;
        const deltaRollingWo = deltaRollingWoPrev + dailyDeltaWo;
        
        const percSaldatoVsTarget = saldatoTgt !== 0 ? (dailyDeltaSaldato / saldatoTgt) * 100 : 0;
        
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
        
        if (datiOggi.venditeDelGiorno.length > 0) {
            if (window.confirm("Vuoi anche scaricare il PDF con il dettaglio delle vendite da allegare all'email?")) {
                generateSalesPdf(datiOggi.venditeDelGiorno, `Dettaglio Vendite del ${new Date().toLocaleDateString('it-IT')}`);
            }
        }

        const { fatturato, pacchetti, sole, valoreSole } = manualInputs;

        const oggi = new Date();
        const periodYYYYMM = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
        try {
            const userId = window.mioCodiceUtente || auth.currentUser?.uid;
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/datiMensili`, periodYYYYMM);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const adminData = docSnap.data();
                const oggiStr = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
                const dayColumnIndex = adminData.dateHeaders.findIndex(h => h === oggiStr);

                if (dayColumnIndex !== -1) {
                    let deltaRollingCount = 0;
                    
                    adminData.metrics.forEach(metric => {
                        const metricNameLower = metric.name.trim().toLowerCase();

                        switch(metricNameLower) {
                            case 'saldato cy':
                                metric.values[dayColumnIndex] = parseFloat(fatturato) || 0;
                                break;
                            case 'wo cy':
                                metric.values[dayColumnIndex] = datiOggi.sommario.totaleWO;
                                break;
                            case 'first act':
                                metric.values[dayColumnIndex] = datiOggi.sommario.primiOrdini;
                                break;
                            case 'second act':
                                metric.values[dayColumnIndex] = datiOggi.sommario.secondiOrdini;
                                break;
                            case 'delta rolling':
                                if (deltaRollingCount === 0) {
                                    metric.values[dayColumnIndex] = displayData.deltaRollingSaldato;
                                } else if (deltaRollingCount === 1) {
                                    metric.values[dayColumnIndex] = displayData.deltaRollingWo;
                                }
                                deltaRollingCount++;
                                break;
                            default:
                                break;
                        }
                    });

                    await setDoc(doc(db, `artifacts/${appId}/users/${userId}/datiMensili`, periodYYYYMM), adminData);
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
        
        body += `Saluti,\nIl Sistema Gestionale`;

        const mailtoLink = `mailto:${selectedEmails.join(',')}?subject=Report Chiusura Giornaliera&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
        toast.success("Il client di posta è stato aperto. Se hai scelto di scaricare il PDF, ricordati di allegarlo.");
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
        const filteredVendite = getFilteredData(e.target);
        generateSalesPdf(filteredVendite); // Usa la funzione helper
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
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] border rounded-lg">
                <table className="min-w-full bg-white text-sm whitespace-nowrap">
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
            <div className="flex flex-wrap justify-end gap-2 mt-6">
                <Button type="button" onClick={onClose} variant="neutral" className="flex-1 sm:flex-none">Annulla</Button>
                <Button type="button" onClick={handleVisualizza} icon={Eye} variant="success" className="flex-1 sm:flex-none">Visualizza</Button>
                <Button type="submit" icon={Download} className="flex-1 sm:flex-none">Genera PDF</Button>
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
// --- EXPORTS ---
// ===================================================================================
export {
    Podio, VistaGraficiCompetizione, StatisticheAvanzate, StatisticheVendite, AnalisiVisiva,
    InviaDatiCassettoModal, GestioneDatiModal,
    Amministrazione, DatiMensili, InvioChiusura, FiltraPdf
};
