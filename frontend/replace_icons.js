const fs = require('fs');
const path = require('path');

const iconMap = {
  'Warehouse': 'BoxCubeIcon',
  'Thermometer': 'InfoIcon',
  'AlertTriangle': 'AlertIcon',
  'X': 'CloseIcon',
  'Info': 'InfoIcon',
  'Snowflake': 'InfoIcon',
  'Flame': 'AlertIcon',
  'PackageCheck': 'CheckCircleIcon',
  'ArrowRight': 'ArrowRightIcon',
  'CheckCircle': 'CheckCircleIcon',
  'Download': 'DownloadIcon',
  'FileText': 'DocsIcon',
  'FileSpreadsheet': 'FileIcon',
  'Bell': 'BellIcon',
  'Clock': 'TimeIcon',
  'ThermometerSnowflake': 'InfoIcon',
  'CheckCircle2': 'CheckCircleIcon',
  'MessageSquare': 'ChatIcon',
  'Send': 'PaperPlaneIcon',
  'Bot': 'InfoIcon',
  'User': 'UserIcon',
  'Loader2': 'TimeIcon',
  'FlaskConical': 'BoxIcon',
  'XCircle': 'CloseLineIcon',
  'Cpu': 'BoltIcon',
  'UploadCloud': 'DocsIcon',
  'Camera': 'VideoIcon',
  'Plus': 'PlusIcon',
  'Calendar': 'CalenderIcon',
  'Flag': 'InfoIcon',
  'Trash2': 'TrashBinIcon',
  'Eye': 'EyeIcon',
  'EyeOff': 'EyeCloseIcon',
  'Leaf': 'BoxCubeIcon',
  'AlertCircle': 'AlertIcon',
  'Search': 'GridIcon',
  'RefreshCw': 'TimeIcon',
  'Truck': 'PaperPlaneIcon',
  'Package': 'BoxIcon',
  'UserPlus': 'UserIcon',
  'Edit2': 'PencilIcon',
  'UserX': 'UserIcon',
  'Check': 'CheckLineIcon',
  'Filter': 'ListIcon'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Find all lucide-react imports
  const lucideRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g;
  let match;
  let neededIcons = new Set();
  
  while ((match = lucideRegex.exec(content)) !== null) {
    const importedIcons = match[1].split(',').map(i => i.trim()).filter(Boolean);
    for (let icon of importedIcons) {
      if (iconMap[icon]) {
        neededIcons.add(iconMap[icon]);
        
        // Replace all <Icon ... /> tags with <NewIcon ... />
        const tagRegex = new RegExp(`<${icon}(\\s+[^>]*?)?>`, 'g');
        content = content.replace(tagRegex, `<${iconMap[icon]}>`); // Remove classes inside icons as template icons don't need them or have predefined sizes, wait, no, just keep them or remove them. Template SVGs sometimes take classes. Let's keep them empty for safety: `<NewIcon />` to avoid weird sizing.
        // Actually, just replace `<Icon...>` with `<NewIcon />`
        content = content.replace(new RegExp(`<${icon}\\s*/>`, 'g'), `<${iconMap[icon]} />`);
        content = content.replace(new RegExp(`<${icon}\\s+[^>]*/>`, 'g'), `<${iconMap[icon]} />`);
        
        // Sometimes icons are passed as props like `icon={Clock}`
        content = content.replace(new RegExp(`icon=\\{${icon}\\}`, 'g'), `icon={${iconMap[icon]}}`);
      }
    }
  }

  // Remove the lucide-react import completely
  content = content.replace(lucideRegex, '');

  if (neededIcons.size > 0) {
    // Check if '@/icons' is already imported
    const iconsImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/icons['"];?/;
    const iconsMatch = content.match(iconsImportRegex);
    if (iconsMatch) {
      let existingIcons = iconsMatch[1].split(',').map(i => i.trim()).filter(Boolean);
      neededIcons.forEach(icon => {
        if (!existingIcons.includes(icon)) existingIcons.push(icon);
      });
      content = content.replace(iconsImportRegex, `import { ${existingIcons.join(', ')} } from '@/icons';`);
    } else {
      // Add the import at the top (after the first import)
      const importStatement = `\nimport { ${Array.from(neededIcons).join(', ')} } from '@/icons';\n`;
      // Find the first import
      const firstImportIndex = content.indexOf('import ');
      if (firstImportIndex !== -1) {
        const endOfFirstImport = content.indexOf('\n', firstImportIndex);
        content = content.slice(0, endOfFirstImport + 1) + importStatement + content.slice(endOfFirstImport + 1);
      } else {
        content = importStatement + content;
      }
    }
  }

  // Clean up any remaining <Icon className="..." /> that didn't match the regex perfectly
  // because some might span multiple lines.
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
