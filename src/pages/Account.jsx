import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth, db, updatePassword, deleteUser, signOut, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, doc, getDoc } from '../services/backend';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Key, Trash2, LogOut, User, Lock, Copy, Share2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';

export default function Account() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    // State
    const [familyId, setFamilyId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState(''); // For re-auth
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    // Modals
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showReauthModal, setShowReauthModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // 'password' or 'delete'

    useEffect(() => {
        async function fetchFamilyId() {
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    setFamilyId(userDoc.data().familyId);
                }
            }
        }
        fetchFamilyId();
    }, [currentUser]);

    async function handleLogout() {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
            setMessage({ type: 'error', text: 'Kunne ikke logge ut.' });
        }
    }

    async function handleSendPasswordReset() {
        if (window.confirm(`Sende e-post for passord-nullstilling til ${currentUser.email}?`)) {
            try {
                await sendPasswordResetEmail(auth, currentUser.email);
                setMessage({ type: 'success', text: 'E-post sendt! Sjekk innboksen din.' });
            } catch (error) {
                console.error("Reset failed", error);
                setMessage({ type: 'error', text: 'Kunne ikke sende e-post.' });
            }
        }
    }

    async function handleReauthAndAction() {
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);

            // Re-auth successful, proceed with action
            if (pendingAction === 'password') {
                if (newPassword !== confirmPassword) {
                    setMessage({ type: 'error', text: 'Passordene er ikke like.' });
                    setLoading(false);
                    return;
                }
                await updatePassword(currentUser, newPassword);
                setMessage({ type: 'success', text: 'Passordet er oppdatert!' });
                setNewPassword('');
                setConfirmPassword('');
            } else if (pendingAction === 'delete') {
                await deleteUser(currentUser);
                navigate('/login');
            }

            setShowReauthModal(false);
            setCurrentPassword('');
            setPendingAction(null);

        } catch (error) {
            console.error("Action failed", error);
            if (error.code === 'auth/wrong-password') {
                setMessage({ type: 'error', text: 'Feil passord.' });
            } else {
                setMessage({ type: 'error', text: 'Noe gikk galt. Prøv igjen.' });
            }
        } finally {
            setLoading(false);
        }
    }

    function initUpdatePassword(e) {
        e.preventDefault();
        if (!newPassword || !confirmPassword) return; // Basic client check

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passordene er ikke like.' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Passordet må ha minst 6 tegn.' });
            return;
        }

        setPendingAction('password');
        setShowReauthModal(true);
    }

    function initDeleteAccount() {
        setPendingAction('delete');
        setShowDeleteConfirm(true);
    }

    return (
        <div className="min-h-screen bg-background text-white pb-20 sm:pb-0">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/5 px-4 pb-4 flex items-center gap-4 transition-all" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
                <Link to="/" className="p-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} className="rtl:rotate-180" />
                </Link>
                <h1 className="text-xl font-bold flex-grow">{t('account.title')}</h1>
            </header>

            <main className="p-4 sm:p-8 max-w-xl mx-auto space-y-8">

                {/* Language Switcher */}
                <div className="bg-surface rounded-2xl p-6 border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-4 rounded-full text-blue-400">
                            <Globe size={32} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{t('account.language')}</h2>
                            <p className="text-gray-400">{t('account.languageDesc')}</p>
                        </div>
                    </div>
                    <select
                        value={i18n.language}
                        onChange={(e) => changeLanguage(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none"
                    >
                        <option value="nb">Norsk</option>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                        <option value="ar">العربية</option>
                    </select>
                </div>

                {/* User Info */}
                <div className="bg-surface rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                    <div className="bg-primary/20 p-4 rounded-full text-primary">
                        <User size={32} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{t('account.loggedInAs')}</h2>
                        <p className="text-gray-400">{currentUser?.email}</p>
                    </div>
                </div>

                {/* Invite Code */}
                {familyId && (
                    <section className="bg-gradient-to-br from-primary/20 to-blue-600/10 rounded-2xl p-6 border border-primary/20 space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-primary-300">
                            <Share2 size={20} className="text-primary-400" />
                            {t('account.inviteTitle')}
                        </h2>
                        <p className="text-sm text-gray-400">
                            {t('account.inviteDesc')}
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono text-center tracking-wider select-all">
                                {familyId}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(familyId);
                                    setMessage({ type: 'success', text: 'Kode kopiert til utklippstavlen!' });
                                }}
                                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 p-3 rounded-xl transition-colors"
                            >
                                <Copy size={24} />
                            </button>
                        </div>
                    </section>
                )}

                {/* Messages */}
                {message.text && (
                    <div className={`p-4 rounded-xl ${message.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {message.text}
                    </div>
                )}

                {/* Change Password */}
                <section className="bg-surface rounded-2xl p-6 border border-white/5 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Key size={20} className="text-gray-400" />
                        {t('account.changePassword')}
                    </h2>
                    <form onSubmit={initUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">{t('account.newPassword')}</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-background border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder={t('account.placeholderPassword')}
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">{t('account.confirmPassword')}</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full bg-background border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'border-red-500 focus:ring-red-500/50' : 'border-gray-700 focus:ring-primary/50'}`}
                                placeholder={t('account.placeholderConfirm')}
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!newPassword || !confirmPassword || loading}
                            className="bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl w-full transition-colors"
                        >
                            {t('account.btnUpdatePassword')}
                        </button>
                    </form>

                    <div className="pt-4 border-t border-white/5 text-center">
                        <button
                            type="button"
                            onClick={handleSendPasswordReset}
                            className="text-sm text-gray-400 hover:text-white underline transition-colors"
                        >
                            {t('account.forgotPassword')}
                        </button>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="space-y-4 pt-8 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-surface hover:bg-white/5 text-gray-400 hover:text-white border border-white/10 font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={20} className="rtl:rotate-180" />
                        {t('account.logout')}
                    </button>

                    <button
                        onClick={initDeleteAccount}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={20} />
                        {t('account.deleteAccount')}
                    </button>
                </section>

            </main>

            {/* Confirm Delete Modal */}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title={t('account.confirmDeleteTitle')}
                message={t('account.confirmDeleteMessage')}
                confirmText={t('account.btnDeleteConfirm')}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    setShowReauthModal(true);
                }}
            />

            {/* Re-auth Modal */}
            {showReauthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-md p-6 border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">{t('account.reauthTitle')}</h3>
                        <p className="text-gray-400 mb-4">
                            {t('account.reauthDesc')}{pendingAction === 'delete' ? t('account.actionDelete') : t('account.actionChangePw')}
                        </p>

                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder={t('account.placeholderCurrentPw')}
                            className="w-full bg-background border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReauthModal(false);
                                    setPendingAction(null);
                                    setCurrentPassword('');
                                }}
                                className="flex-1 bg-surface border border-white/10 hover:bg-white/5 text-white py-3 rounded-xl"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleReauthAndAction}
                                disabled={!currentPassword || loading}
                                className={`flex-1 font-bold py-3 rounded-xl text-white ${pendingAction === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-blue-600'}`}
                            >
                                {loading ? t('common.loading') : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
