"use client";
import React, { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel } from '@/lib/utils';
import { UserIcon, InfoIcon, GridIcon, PlugInIcon } from '@/icons';

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const initial = user?.name?.charAt(0).toUpperCase() || "U";
  const firstName = user?.name?.split(' ')[0] || "User";

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown} 
        className="flex items-center text-gray-700 dark:text-gray-400 dropdown-toggle"
      >
        <span className="mr-3 overflow-hidden rounded-full h-10 w-10 flex items-center justify-center bg-gradient-to-br from-brand-500 to-orange-600 shadow-sm shrink-0">
          <span className="text-white text-sm font-bold">{initial}</span>
        </span>

        <span className="block mr-1 font-medium text-theme-sm">{firstName}</span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="px-3 pb-3">
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-200">
            {user?.name || "User Name"}
          </span>
          <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-500">
            {getRoleLabel(user?.role || '')}
          </span>
        </div>

        <ul className="flex flex-col gap-1 pt-3 pb-3 border-y border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="#"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
            >
              <UserIcon />
              Edit profile
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="#"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
            >
              <GridIcon />
              Account settings
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="#"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
            >
              <InfoIcon />
              Support
            </DropdownItem>
          </li>
        </ul>
        <button
          onClick={() => {
            closeDropdown();
            logout();
          }}
          className="flex w-full items-center gap-3 px-3 py-2 mt-3 font-medium text-red-500 rounded-lg group text-theme-sm hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <PlugInIcon />
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
