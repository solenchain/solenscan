import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="SolenScan" width={20} height={20} className="h-5 w-5" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SolenScan</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Solen Blockchain Explorer</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <a href="https://x.com/solenchain" target="_blank" rel="noopener" className="hover:text-gray-600 dark:hover:text-gray-400">X</a>
            <a href="https://discord.com/invite/QGxv8bebJc" target="_blank" rel="noopener" className="hover:text-gray-600 dark:hover:text-gray-400">Discord</a>
            <a href="https://t.me/solenblockchain" target="_blank" rel="noopener" className="hover:text-gray-600 dark:hover:text-gray-400">Telegram</a>
            <a href="https://github.com/Solen-Blockchain" target="_blank" rel="noopener" className="hover:text-gray-600 dark:hover:text-gray-400">GitHub</a>
            <a href="https://docs.solenchain.io" target="_blank" rel="noopener" className="hover:text-gray-600 dark:hover:text-gray-400">Docs</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
