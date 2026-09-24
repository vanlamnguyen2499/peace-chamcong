import * as fs from 'fs';
import * as path from 'path';

function patch(file: string) {
  const p = path.resolve('src/components', file);
  let content = fs.readFileSync(p, 'utf-8');
  if (!content.includes('usePathname')) {
    content = content.replace("import Link", "import { usePathname } from 'next/navigation';\nimport Link");
  }
  
  if (content.includes('export default function')) {
    const fnMatch = content.match(/export default function \w+\(\) \{/);
    if (fnMatch) {
      if (!content.includes('pathname.startsWith(\'/m\')')) {
        content = content.replace(fnMatch[0], `${fnMatch[0]}\n  const pathname = usePathname();\n  if (pathname?.startsWith('/m')) return null;`);
        fs.writeFileSync(p, content);
        console.log(`Patched ${file}`);
      }
    }
  }
}

patch('Navbar.tsx');
patch('Sidebar.tsx');
patch('MobileBottomNav.tsx'); // This one already has usePathname
