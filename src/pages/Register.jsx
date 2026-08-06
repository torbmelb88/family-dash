import { useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, doc, setDoc, collection, addDoc, writeBatch, getDoc, updateDoc, arrayUnion } from '../services/backend';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Users, ArrowRight } from 'lucide-react';

export default function Register() {
    const [isJoining, setIsJoining] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Helper: Create new family
    async function createNewFamily(user, userName) {
        // 1. Create Family Document
        const familyRef = await addDoc(collection(db, 'families'), {
            members: [{ uid: user.uid, name: userName || 'Admin', photoURL: user.photoURL || '', role: 'admin' }],
            createdAt: new Date()
        });

        // 2. Create Default Categories
        const categoriesRef = collection(db, `families/${familyRef.id}/shoppingListCategories`);
        const defaultCategories = [
            { name: 'Frukt & Grønt', order: 0 },
            { name: 'Kjøtt, Fisk & Fjærkre', order: 1 },
            { name: 'Meieriprodukter & Egg', order: 2 },
            { name: 'Bakevarer & Korn', order: 3 },
            { name: 'Tørrvarer & Hermetikk', order: 4 },
            { name: 'Drikkevarer', order: 5 },
            { name: 'Snacks & Godteri', order: 6 },
            { name: 'Annet', order: 7 },
        ];
        const batch = writeBatch(db);
        defaultCategories.forEach(cat => {
            const docRef = doc(categoriesRef);
            batch.set(docRef, cat);
        });
        await batch.commit();

        // 3. Link User to Family
        await setDoc(doc(db, 'users', user.uid), {
            familyId: familyRef.id
        });
    }

    // Helper: Join existing family
    async function joinExistingFamily(user, code, userName) {
        const familyRef = doc(db, 'families', code);
        const familyDoc = await getDoc(familyRef);

        if (!familyDoc.exists()) {
            throw new Error('Fant ingen familie med denne koden.');
        }

        // Add to members array
        await updateDoc(familyRef, {
            members: arrayUnion({
                uid: user.uid,
                name: userName || user.displayName || 'Medlem',
                photoURL: user.photoURL || '',
                role: 'member'
            })
        });

        // Link User to Family
        await setDoc(doc(db, 'users', user.uid), {
            familyId: code
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);

            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (isJoining) {
                if (!inviteCode) throw new Error("Du må skrive inn en familiekode.");
                await joinExistingFamily(user, inviteCode, name);
            } else {
                await createNewFamily(user, name);
            }

            navigate('/');
        } catch (err) {
            console.error("Registration failed", err);
            setError(err.message.includes('auth') ? 'Kunne ikke opprette bruker.' : err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleRegister() {
        try {
            setError('');
            setLoading(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user already exists
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                // User exists, just log in
                navigate('/');
                return;
            }

            if (isJoining) {
                if (!inviteCode) {
                    // Start simple: If Google auth but joining logic requires code, 
                    // we ideally should prompt for code first or allow entering it after.
                    // For now, if "Bli med" tab is active, we expect code to be typed if user clicks Google button.
                    // BUT UI-wise Google button is outside the specific form fields sometimes.
                    // Let's rely on the input field being filled even if Google is clicked.
                    if (!inviteCode) throw new Error("Skriv inn familiekoden i feltet under 'Bli med' før du velger Google, eller bruk e-post.");
                }
                await joinExistingFamily(user, inviteCode, name);
            } else {
                await createNewFamily(user, name);
            }

            navigate('/');

        } catch (err) {
            console.error("Google register failed", err);
            setError('Jada ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-2xl border border-white/5 backdrop-blur-sm">
                <h2 className="text-3xl font-bold text-center mb-6 text-white">Velkommen</h2>

                {/* Tabs */}
                <div className="flex bg-black/20 p-1 rounded-xl mb-8">
                    <button
                        onClick={() => setIsJoining(false)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isJoining ? 'bg-secondary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Start ny familie
                    </button>
                    <button
                        onClick={() => setIsJoining(true)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isJoining ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Bli med i familie
                    </button>
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}

                <div className="space-y-6">
                    {/* Google Button - Context aware text */}
                    <button
                        onClick={handleGoogleRegister}
                        disabled={loading}
                        className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:bg-gray-100 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {isJoining ? 'Bli med med Google' : 'Opprett med Google'}
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="h-px bg-white/10 flex-grow"></div>
                        <span className="text-gray-500 text-sm">eller bruk e-post</span>
                        <div className="h-px bg-white/10 flex-grow"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isJoining && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-primary-300 ml-1">Familiekode</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 h-5 w-5" />
                                    <input
                                        type="text"
                                        required={isJoining}
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value)}
                                        className="w-full bg-primary/10 border border-primary/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-mono tracking-wider"
                                        placeholder="Lim inn kode her..."
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Ditt navn</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-background/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all"
                                    placeholder="Ola Nordmann"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">E-post</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-background/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all"
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
                                    className="w-full bg-background/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all"
                                    placeholder="Minst 6 tegn"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isJoining ? 'bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-primary/25' : 'bg-gradient-to-r from-secondary to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-secondary/25'}`}
                        >
                            {loading ? 'Jobber...' : (isJoining ? 'Bli med i familien' : 'Opprett familie')}
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-gray-400 text-sm">
                            Har du allerede en konto?{' '}
                            <Link to="/login" className="text-secondary hover:text-emerald-400 font-medium transition-colors">
                                Logg inn her
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
