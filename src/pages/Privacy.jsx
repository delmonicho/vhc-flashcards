export default function Privacy({ onNavigate }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center gap-1.5 text-sm text-co-muted dark:text-gray-400 hover:text-co-primary dark:hover:text-co-primary transition-colors cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-co-ink dark:text-gray-100">Privacy Policy</h1>
        <p className="text-sm text-co-muted dark:text-gray-400 mt-1">Last updated: March 28, 2026</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">What we collect</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-co-muted dark:text-gray-400">
          <li>Your email address (for sign-in only)</li>
          <li>Vocabulary and flashcards you create</li>
          <li>Study progress and game stats</li>
          <li>Your chosen display name and profile color</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">What we never do</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-co-muted dark:text-gray-400">
          <li>Sell or share your data with third parties</li>
          <li>Show you advertisements</li>
          <li>Use your content to train AI models</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Third-party services</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-co-muted dark:text-gray-400">
          <li>
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-co-primary transition-colors">
              Supabase
            </a>
            {' '}— stores your account and data securely
          </li>
          <li>
            <a href="https://cloud.google.com/terms/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-co-primary transition-colors">
              Google Cloud Translation
            </a>
            {' '}— processes vocabulary text to generate translations
          </li>
          <li>
            <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-co-primary transition-colors">
              Anthropic
            </a>
            {' '}— processes text for conversation practice and phrase breakdowns
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Your rights</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-co-muted dark:text-gray-400">
          <li>You can delete your account and all data at any time from your Profile settings</li>
          <li>You can export your vocabulary by contacting us</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Contact</h2>
        <p className="text-sm text-co-muted dark:text-gray-400">
          This app is a personal project. For questions, contact your class instructor.
        </p>
      </section>
    </div>
  )
}
