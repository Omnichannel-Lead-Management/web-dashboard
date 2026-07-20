import { initialAppointments } from '../data/mockData'
export const appointmentService = { list:()=>Promise.resolve(structuredClone(initialAppointments)), create:(item)=>Promise.resolve({...item,id:Date.now()}) }
