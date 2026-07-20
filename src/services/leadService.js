import { leads } from '../data/mockData'
export const leadService = { list:()=>Promise.resolve(structuredClone(leads)), get:(id)=>Promise.resolve(structuredClone(leads.find(l=>l.id===id))) }
