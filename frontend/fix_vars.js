const fs = require('fs');

let content = fs.readFileSync('src/app/qc/page.tsx', 'utf8');

// Replace stats variables with actual qc/page.tsx variables
content = content.replace(/stats\?\.pending_qc \?\? 0/g, 'pendingMaterials.length');
content = content.replace(/stats\?\.completed_today \?\? 0/g, 'todayChecks.length');
content = content.replace(/stats\?\.pass_rate \?\? 0/g, 'passRate');
content = content.replace(/stats\?\.passed_today \?\? 0/g, "todayChecks.filter(c => c.result === 'pass').length");

// Fix setViewModalOpen -> setShowAiModal
content = content.replace(/setViewModalOpen/g, 'setShowAiModal');

fs.writeFileSync('src/app/qc/page.tsx', content, 'utf8');
console.log('Fixed vars in qc/page.tsx');
