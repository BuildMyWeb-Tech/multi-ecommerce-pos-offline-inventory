// components/PoweredBy.jsx
export default function PoweredBy({ className = '' }) {
  return (
    <div className={`text-center text-xs text-slate-400 py-2 ${className}`}>
      Powered by{' '}
      <a
        href="http://buildmyweb.info/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-slate-500 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
      >
        BuildMyWeb
      </a>
    </div>
  );
}
