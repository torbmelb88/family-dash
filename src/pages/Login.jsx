import { useState } from 'react';
import { auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, isFirebaseConfigured, enableDemo } from '../services/backend';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Sparkles } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err) {
            setError('Kunne ikke logge inn. Sjekk e-post og passord.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        try {
            setError('');
            setLoading(true);
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/');
        } catch (err) {
            console.error("Google login failed", err);
            setError('Kunne ikke logge inn med Google.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-2xl border border-white/5 backdrop-blur-sm">
                <h2 className="text-3xl font-bold text-center mb-2 text-white">Velkommen tilbake</h2>
                <p className="text-center text-gray-400 mb-8">Logg inn for å se familiens dashboard</p>

                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}

                <button
                    onClick={enableDemo}
                    className="w-full bg-gradient-to-r from-secondary to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-secondary/25 flex items-center justify-center gap-2 mb-3"
                >
                    <Sparkles className="w-5 h-5" />
                    Prøv demo med testdata
                </button>
                <p className="text-center text-gray-500 text-xs mb-6">
                    {isFirebaseConfigured
                        ? 'Utforsk appen med en fiktiv familie — ingen konto trengs.'
                        : 'Firebase er ikke konfigurert, så innlogging er utilgjengelig. Demoen fungerer uten oppsett.'}
                </p>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:bg-gray-100 flex items-center justify-center gap-2 mb-6"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Logg inn med Google
                </button>

                <div className="flex items-center gap-4 mb-6">
                    <div className="h-px bg-white/10 flex-grow"></div>
                    <span className="text-gray-500 text-sm">eller med e-post</span>
                    <div className="h-px bg-white/10 flex-grow"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">E-post</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-background/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                placeholder="din@epost.no"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Passord</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-background/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Logger inn...' : 'Logg inn'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm">
                        Har du ikke en familie enda?{' '}
                        <Link to="/register" className="text-primary hover:text-blue-400 font-medium transition-colors">
                            Opprett ny familie
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
