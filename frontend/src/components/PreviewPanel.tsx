const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
font-family:-apple-system,BlinkMacSystemFont,sans-serif;
background:linear-gradient(135deg,#f5f7fa 0%,#e8ecf0 100%);color:#94a3b8;}
.p{text-align:center}.i{font-size:3rem;margin-bottom:12px}p{font-size:.9rem}
</style></head><body><div class="p"><div class="i">🖼️</div><p>你的应用将在这里渲染</p></div></body></html>`;

export function PreviewPanel({ code }: { code: string }) {
  const htmlContent = code || PLACEHOLDER_HTML;
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-gray-400 font-mono ml-2">
          {code ? '⚡ 预览' : '等待生成...'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          key={htmlContent}
          srcDoc={htmlContent}
          sandbox="allow-scripts allow-forms allow-modals"
          title="preview"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
