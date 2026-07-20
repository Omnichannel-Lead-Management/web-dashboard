export const currentBusiness = { name: 'Elegant Salon', id: 'BIZ-ELG-2048', sector: 'Salon & beauty', city: 'Colombo', email: 'hello@elegantsalon.lk', phone: '+94 77 234 5678' }
export const currentAgent = { name: 'Sithumi Perera', shortName: 'Sithumi', initials: 'SP', role: 'Agent' }

export const conversations = [
  { id:'A12F', name:'Kasun Perera', handle:'@kasun_p', initials:'KP', channel:'Telegram', time:'2m', preview:'Can I speak to someone about the premium package?', status:'qualified', score:72, unread:true, escalated:true, claimed:false, language:'EN', email:'kasun.p@email.com', phone:'+94 77 456 0192', location:'Colombo 05', interest:'Premium package' },
  { id:'B77C', name:'Amaya Rathnayake', handle:'+94 71 882 3104', initials:'AR', channel:'WhatsApp', time:'18m', preview:'Do you have slots on Saturday for coloring?', status:'contacted', score:55, unread:true, claimed:true, language:'EN', email:'amaya.r@email.com', phone:'+94 71 882 3104', location:'Nugegoda', interest:'Coloring' },
  { id:'D204', name:'Tharindu Fonseka', handle:'@tharindu_f', initials:'TF', channel:'Telegram', time:'1h', preview:'Thanks! See you Thursday 👋', status:'converted', score:88, unread:false, claimed:true, language:'EN', email:'tharindu@email.com', phone:'+94 76 991 8200', location:'Rajagiriya', interest:'Haircut' },
  { id:'C019', name:'Web visitor', handle:'Visitor 8821', initials:'W', channel:'Web', time:'3h', preview:'What are your opening hours?', status:'new', score:22, unread:true, claimed:false, language:'EN', email:'Not provided', phone:'Not provided', location:'Sri Lanka', interest:'Opening hours' },
  { id:'E551', name:'Dinuka Jayawardena', handle:'+94 75 343 9910', initials:'DJ', channel:'WhatsApp', time:'Yesterday', preview:'Perfect, thank you so much!', status:'contacted', score:47, unread:false, claimed:true, language:'EN', email:'dinuka@email.com', phone:'+94 75 343 9910', location:'Colombo 07', interest:'Bridal package' },
]

export const messagesByConversation = {
  A12F: [
    { id:1, sender:'customer', text:'Hi! How much is a haircut and do you do premium packages?', time:'11:42 PM' },
    { id:2, sender:'bot', text:'Our signature haircut is Rs. 1,500. The Premium Package (cut, wash & styling) is Rs. 4,200. Would you like to book a slot?', time:'11:42 PM' },
    { id:3, sender:'customer', text:'Can I speak to someone about the premium package?', time:'11:45 PM' },
  ],
  B77C:[{id:1,sender:'customer',text:'Do you have slots on Saturday for coloring?',time:'10:18 AM'}],
  D204:[{id:1,sender:'agent',text:'Your Thursday appointment is confirmed.',time:'9:32 AM'},{id:2,sender:'customer',text:'Thanks! See you Thursday 👋',time:'9:35 AM'}],
  C019:[{id:1,sender:'customer',text:'What are your opening hours?',time:'8:10 AM'}],
  E551:[{id:1,sender:'customer',text:'Perfect, thank you so much!',time:'Yesterday'}],
}

export const leads = conversations.map((c, i) => ({ ...c, agent: i === 3 ? 'Unassigned' : i === 4 ? 'Nimali F.' : 'Sithumi P.', age:c.time, created:'23 Jul 2026', notes:'Interested in services and ready for a follow-up.' })).concat([
  { id:'F890', name:'Ishara Silva', initials:'IS', channel:'Telegram', status:'lost', score:15, interest:'Kids haircut', agent:'Unassigned', age:'5d', created:'18 Jul 2026', email:'ishara@email.com', phone:'+94 70 222 1098', location:'Kandy', notes:'Asked for weekend availability.' }
])

export const initialAppointments = [
  {id:1,date:'2026-07-23',day:'Today · Thursday, 23 Jul',time:'2:00',ampm:'PM',customer:'Kasun Perera',service:'Premium package',duration:'60 min',status:'confirmed',staff:'Sithumi'},
  {id:2,date:'2026-07-23',day:'Today · Thursday, 23 Jul',time:'4:30',ampm:'PM',customer:'Amaya Rathnayake',service:'Coloring',duration:'90 min',status:'confirmed',staff:'Nimali'},
  {id:3,date:'2026-07-24',day:'Tomorrow · Friday, 24 Jul',time:'10:00',ampm:'AM',customer:'Dinuka Jayawardena',service:'Bridal trial',duration:'120 min',status:'confirmed',staff:'Nimali'},
  {id:4,date:'2026-07-24',day:'Tomorrow · Friday, 24 Jul',time:'1:00',ampm:'PM',customer:'Ishara Silva',service:'Kids haircut',duration:'30 min',status:'completed',staff:'Sithumi'},
]

export const analytics = { metrics:[['Conversations','284','↑ 12%'],['New leads','126','↑ 18%'],['Conversion rate','32.5%','↑ 4.2%'],['Appointments','41','↑ 9']], statuses:[['New',28],['Contacted',34],['Qualified',24],['Converted',14]], platforms:[['Telegram',55],['WhatsApp',27],['Web',18]] }
export const channels = [{name:'Telegram',connected:true,detail:'@ElegantSalonSupportBot'},{name:'WhatsApp',connected:false,detail:'Optional channel'},{name:'Web chat',connected:true,detail:'Widget active'}]
