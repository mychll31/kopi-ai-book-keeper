"use client";
import { useState } from "react";
import { Tags, Utensils, Plane, Car, House, ShoppingBag, Wallet, Receipt, Coffee, HeartPulse, GraduationCap, Gift, Monitor, ChevronDown, Check } from "lucide-react";
import { TYPE_ICONS } from "@/lib/transaction-types";
import "./type-picker.css";
const icons = { tag: Tags, food: Utensils, travel: Plane, transport: Car, home: House, shopping: ShoppingBag, salary: Wallet, bills: Receipt, coffee: Coffee, health: HeartPulse, education: GraduationCap, gift: Gift, tech: Monitor };
export function TypeIcon({icon}: {icon: string}) {
  const Icon = icons[icon as keyof typeof icons] || Tags;
  return <Icon size={18} aria-hidden="true" />;
}
export function IconPicker({value, onChange, disabled = false}: {value:string; onChange:(v:string)=>void; disabled?:boolean}) {
  return <div className="type-icon-picker" role="group" aria-label="Choose an icon">{TYPE_ICONS.map(icon => <button type="button" key={icon} disabled={disabled} aria-label={icon} title={icon} aria-pressed={value === icon} onClick={() => onChange(icon)}><TypeIcon icon={icon}/></button>)}</div>;
}
export default function TypePicker({types, value, onChange, iconFor}: {types:string[]; value:string; onChange:(v:string)=>void; iconFor:(v:string)=>string}) {
  const [open,setOpen] = useState(false), [search,setSearch] = useState("");
  const options = ["", ...types].filter(t => (t || "Uncategorized").toLowerCase().includes(search.toLowerCase()));
  return <div className="type-picker">
    <button type="button" className="type-picker-trigger" aria-expanded={open} onClick={() => {setOpen(!open);setSearch("");}}><TypeIcon icon={iconFor(value)}/><span>{value || "Uncategorized"}</span><ChevronDown size={16}/></button>
    {open && <div className="type-picker-panel" onKeyDown={e => {if(e.key === "Escape"){e.stopPropagation();setOpen(false);}}}>
      <input autoFocus aria-label="Search transaction types" placeholder="Search types…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="type-picker-options">{options.map(type => <button type="button" key={type} aria-pressed={value === type} onClick={()=>{onChange(type);setOpen(false);}}><TypeIcon icon={iconFor(type)}/><span>{type || "Uncategorized"}</span>{value === type && <Check size={16}/>}</button>)}
      {!options.length && <p>No matching types. Add one in Types.</p>}</div>
    </div>}
  </div>;
}
