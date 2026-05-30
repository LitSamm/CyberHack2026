"use client";
import React, { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from '@/contexts/AuthContext';
import {
  GridIcon,
  GroupIcon,
  DocsIcon,
  CheckCircleIcon,
  CalenderIcon,
  BoxCubeIcon,
  PaperPlaneIcon,
  HorizontaLDots,
  BoxIcon,
  PlugInIcon
} from "../icons/index";

interface OriginalNavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
}

const NAV_ITEMS: OriginalNavItem[] = [
  { href: '/admin', icon: <GridIcon />, label: 'Dashboard Admin', roles: ['admin'] },
  { href: '/admin/users', icon: <GroupIcon />, label: 'Manajemen User', roles: ['admin'] },
  { href: '/admin/audit', icon: <DocsIcon />, label: 'Audit Trail', roles: ['admin'] },
  { href: '/materials', icon: <BoxIcon />, label: 'Material Intake', roles: ['warehouse', 'ppic', 'admin'] },
  { href: '/qc', icon: <CheckCircleIcon />, label: 'QC Dashboard', roles: ['qc', 'admin'] },
  { href: '/ppic', icon: <CalenderIcon />, label: 'PPIC & Produksi', roles: ['ppic', 'admin'] },
  { href: '/warehouse', icon: <BoxCubeIcon />, label: 'Gudang', roles: ['warehouse', 'admin'] },
  { href: '/dispatch', icon: <PaperPlaneIcon />, label: 'Pengiriman', roles: ['warehouse', 'ppic', 'admin'] },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  const isActive = useCallback((path: string) => {
    return path === pathname || (path !== '/admin' && pathname.startsWith(path));
  }, [pathname]);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <BoxIcon className="w-5 h-5 text-white" />
          </div>
          {(isExpanded || isHovered || isMobileOpen) && (
            <div>
              <div className="text-gray-900 dark:text-white font-bold text-lg leading-none">AromOS</div>
              <div className="text-brand-500 text-xs mt-0.5">Sima Arome</div>
            </div>
          )}
        </Link>
      </div>
      
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar h-full">
        <nav className="mb-6 flex-1">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              
              <ul className="flex flex-col gap-2">
                {visibleItems.map((nav) => (
                  <li key={nav.label}>
                    <Link
                      href={nav.href}
                      className={`menu-item group ${
                        isActive(nav.href) ? "menu-item-active bg-brand-500/10 text-brand-500" : "menu-item-inactive"
                      }`}
                    >
                      <span
                        className={`${
                          isActive(nav.href)
                            ? "menu-item-icon-active text-brand-500"
                            : "menu-item-icon-inactive"
                        }`}
                      >
                        {nav.icon}
                      </span>
                      {(isExpanded || isHovered || isMobileOpen) && (
                        <span className={`menu-item-text font-medium`}>{nav.label}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
        
        {/* Bottom actions */}
        <div className="mt-auto pb-6">
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 py-2.5 px-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all ${
              !isExpanded && !isHovered ? "justify-center" : "justify-start"
            }`}
          >
            <PlugInIcon className="w-5 h-5 shrink-0" />
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="font-medium">Keluar</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
