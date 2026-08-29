const fs=require('fs');
const p='C:\\Users\\leute\\OneDrive\\Bureau\\Dev\\Woodpacker\\Woodpacker\\src\\app\\developer\\pipeline-inspector\\page.tsx';
let c=fs.readFileSync(p,'utf8');
// Remove extra closing div before ) : (
c=c.replace(
  '              <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/70 text-white pointer-events-none">p.{page} · {pageExercises.length} detected elements</div>\n              </div>\n              </div>\n            </div>\n          </div>',
  '              <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/70 text-white pointer-events-none">p.{page} · {pageExercises.length} detected elements</div>\n              </div>\n            </div>\n          </div>'
);
// Need to ensure only 3 closes after badge, not 4 - if still 4, remove one
let count=(c.match(/              <div className="absolute bottom-2 right-2/g)||[]).length;
console.log('badge count', count);
fs.writeFileSync(p,c,'utf8');
console.log('fixed extra close');
