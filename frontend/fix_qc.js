const fs = require('fs');

function fixFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  for (let [from, to] of Object.entries(replacements)) {
    // Replace <From ... /> with <To ... />
    content = content.replace(new RegExp(`<${from}(\\s+[^>]*?)?/>`, 'g'), `<${to} />`);
    // Replace <From>...</From> with <To>...</To>
    content = content.replace(new RegExp(`<${from}>`, 'g'), `<${to}>`);
    content = content.replace(new RegExp(`</${from}>`, 'g'), `</${to}>`);
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}

// Fix qc/page.tsx
fixFile('src/app/qc/page.tsx', {
  'Download': 'DownloadIcon',
  'AlertTriangle': 'InfoIcon',
  'CheckCircle': 'CheckCircleIcon',
  'Cpu': 'BoltIcon',
  'FlaskConical': 'BoxIcon',
  'XCircle': 'CloseIcon',
  'X': 'CloseIcon',
  'UploadCloud': 'DocsIcon',
  'Camera': 'VideoIcon'
});

// Fix qc/page.tsx imports
let qcContent = fs.readFileSync('src/app/qc/page.tsx', 'utf8');
qcContent = qcContent.replace(/import \{ TimeIcon.*?\} from '@\/icons';/, "import { TimeIcon, BoxIcon, CheckCircleIcon, CloseIcon, DownloadIcon, BoltIcon, InfoIcon, DocsIcon, VideoIcon } from '@/icons';");
fs.writeFileSync('src/app/qc/page.tsx', qcContent, 'utf8');

// Fix Sidebar.tsx
fixFile('src/components/layout/Sidebar.tsx', {
  'LayoutDashboard': 'GridIcon',
  'Users': 'GroupIcon',
  'ChevronRight': 'ArrowRightIcon',
  'LogOut': 'PlugInIcon'
});

// Fix Sidebar.tsx imports
let sbContent = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
sbContent = sbContent.replace(/import \{.*?\} from '@\/icons';/, "import { GridIcon, GroupIcon, ArrowRightIcon, PlugInIcon, DocsIcon, CheckCircleIcon, CalenderIcon, BoxCubeIcon, PaperPlaneIcon, BoxIcon } from '@/icons';");
fs.writeFileSync('src/components/layout/Sidebar.tsx', sbContent, 'utf8');
