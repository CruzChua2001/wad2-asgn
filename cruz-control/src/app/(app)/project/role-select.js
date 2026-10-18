"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LuCheck, LuChevronDown } from "react-icons/lu";

// About the height of the open list (two options plus padding)
const LIST_HEIGHT = 130;

// Themed dropdown for the invite role, since the browser's own <select> list can't be styled
const RoleSelect = ({ roles, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [dropUp, setDropUp] = useState(false);
    const boxRef = useRef(null);
    const reduceMotion = useReducedMotion();
    const id = useId();
    const selected = roles.find(role => role.value === value);

    const toggle = _ => {
        // Open below unless the window doesn't have room for the list there
        if (!open) {
            const box = boxRef.current.getBoundingClientRect();
            setDropUp(window.innerHeight - box.bottom < LIST_HEIGHT);
        }
        setActive(roles.indexOf(selected));
        setOpen(!open);
    }

    const choose = role => {
        onChange(role.value);
        setOpen(false);
    }

    // Works like a normal select: arrows move, Enter or Space picks, Esc closes
    const handleKey = event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) return toggle();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((active + step + roles.length) % roles.length);
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) {
                choose(roles[active]);
            } else {
                toggle();
            }
        } else if (event.key === "Escape" && open) {
            // Close the list but keep the dialog open
            event.preventDefault();
            setOpen(false);
        }
    }

    // Clicking or tabbing anywhere else closes the list
    const handleBlur = event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }

    return (
        <div className="relative" onBlur={handleBlur}>
            <div
                ref={boxRef}
                role="combobox"
                tabIndex={0}
                aria-label="Role"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${id}-list`}
                aria-activedescendant={open ? `${id}-${active}` : undefined}
                onClick={toggle}
                onKeyDown={handleKey}
                className={`flex items-center justify-between gap-2 h-10 min-w-24 px-3 border rounded-xl bg-page text-sm cursor-pointer select-none transition-colors duration-200 ${open ? "border-accent" : "border-line hover:border-accent/60"}`}
            >
                {selected.text}
                <LuChevronDown size={16} aria-hidden="true" className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </div>

            <AnimatePresence>
                {open && (
                    <motion.ul
                        id={`${id}-list`}
                        role="listbox"
                        aria-label="Role"
                        initial={reduceMotion ? false : { opacity: 0, y: dropUp ? 6 : -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: dropUp ? 6 : -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 z-10 grid w-52 gap-0.5 p-1 rounded-xl border border-line bg-surface-strong shadow-lg ${dropUp ? "bottom-full mb-1.5 origin-bottom-right" : "top-full mt-1.5 origin-top-right"}`}
                    >
                        {roles.map((role, index) => (
                            <li
                                key={role.value}
                                id={`${id}-${index}`}
                                role="option"
                                aria-selected={role.value === value}
                                onPointerDown={event => event.preventDefault()}
                                onPointerEnter={() => setActive(index)}
                                onClick={() => choose(role)}
                                className={`flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-150 ${index === active ? "bg-accent-soft/25" : ""}`}
                            >
                                <span className="grid flex-1 gap-0.5">
                                    <span className="text-sm font-medium text-ink">{role.text}</span>
                                    <span className="text-xs text-muted">{role.hint}</span>
                                </span>
                                {role.value === value && <LuCheck size={16} aria-hidden="true" className="mt-0.5 flex-none text-accent" />}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

export default RoleSelect;
