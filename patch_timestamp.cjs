const fs = require('fs');

let content = fs.readFileSync('dashboard/src/App.jsx', 'utf8');

const oldDateBlock = '<span>{new Date(vid.created_at).toLocaleDateString()}</span>';
const newDateBlock = `<div className="flex flex-col">
                            <span className="font-bold text-[11px] text-[var(--text-primary)]">
                              📅 {new Date(vid.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                              🕒 Render: {new Date(vid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>`;

if (content.includes(oldDateBlock)) {
  content = content.replace(oldDateBlock, newDateBlock);
  fs.writeFileSync('dashboard/src/App.jsx', content);
  console.log('App.jsx render timestamp patched successfully!');
} else {
  console.log('Target date block not found');
}
