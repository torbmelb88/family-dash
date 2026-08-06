import { getWeekDocId } from '../utils/dateUtils';

// Syntetiske demo-data for en fiktiv familie. Alle navn og verdier er oppdiktet,
// og ukeplanene genereres relativt til dagens dato slik at demoen alltid ser fersk ut.

export const DEMO_FAMILY_ID = 'demo-familie';

export const DEMO_USER = {
    uid: 'demo-bruker',
    email: 'demo@familydash.example',
    displayName: 'Kari Eksempel',
    photoURL: ''
};

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

const dinners = {
    'd-taco': {
        dish: 'Taco med kylling',
        ingredients: ['Kyllingfilet, 600 g', 'Tacokrydder, 1 pose', 'Tortillalefser, 8 stk', 'Mais, 1 boks', 'Paprika, 1 stk', 'Rømme, 1 beger', 'Revet ost, 200 g', 'Salat, 1 hode'],
        parsedIngredients: [
            { name: 'Kyllingfilet', quantity: '600 g' },
            { name: 'Tacokrydder', quantity: '1 pose' },
            { name: 'Tortillalefser', quantity: '8 stk' },
            { name: 'Mais', quantity: '1 boks' },
            { name: 'Paprika', quantity: '1 stk' },
            { name: 'Rømme', quantity: '1 beger' },
            { name: 'Revet ost', quantity: '200 g' },
            { name: 'Salat', quantity: '1 hode' }
        ],
        recipeLink: null,
        imageUrl: null,
        portions: '4',
        cookTime: '30 min',
        steps: [
            'Skjær kyllingen i strimler og stek den gyllen i panna.',
            'Tilsett tacokrydder og litt vann, og la det småkoke i 5 minutter.',
            'Kutt opp grønnsakene og sett alt tilbehøret på bordet.',
            'Varm lefsene og la alle bygge sin egen taco.'
        ]
    },
    'd-lasagne': {
        dish: 'Lasagne',
        ingredients: ['Kjøttdeig, 400 g', 'Lasagneplater, 1 pakke', 'Hakkede tomater, 2 bokser', 'Løk, 1 stk', 'Hvitløk, 2 fedd', 'Hvit saus, 5 dl', 'Revet ost, 150 g'],
        parsedIngredients: [
            { name: 'Kjøttdeig', quantity: '400 g' },
            { name: 'Lasagneplater', quantity: '1 pakke' },
            { name: 'Hakkede tomater', quantity: '2 bokser' },
            { name: 'Løk', quantity: '1 stk' },
            { name: 'Hvitløk', quantity: '2 fedd' },
            { name: 'Hvit saus', quantity: '5 dl' },
            { name: 'Revet ost', quantity: '150 g' }
        ],
        recipeLink: null,
        imageUrl: null,
        portions: '4',
        cookTime: '60 min',
        steps: [
            'Brun kjøttdeigen med løk og hvitløk.',
            'Tilsett tomater og la sausen småkoke i 15 minutter.',
            'Legg kjøttsaus, hvit saus og lasagneplater lagvis i en form.',
            'Topp med revet ost og stek på 200 °C i ca. 30 minutter.'
        ]
    },
    'd-fiskegrateng': {
        dish: 'Fiskegrateng med makaroni',
        ingredients: ['Fiskegrateng, 1 stor', 'Poteter, 8 stk', 'Gulrøtter, 4 stk', 'Smør, til servering'],
        recipeLink: null,
        imageUrl: null
    },
    'd-karri': {
        dish: 'Kylling i rød karri',
        ingredients: ['Kyllingfilet, 500 g', 'Rød currypaste, 2 ss', 'Kokosmelk, 1 boks', 'Jasminris, 4 porsjoner', 'Sukkererter, 150 g', 'Lime, 1 stk'],
        recipeLink: null,
        imageUrl: null,
        portions: '4',
        cookTime: '25 min'
    },
    'd-bolognese': {
        dish: 'Spagetti bolognese',
        ingredients: ['Kjøttdeig, 400 g', 'Spagetti, 1 pakke', 'Hakkede tomater, 2 bokser', 'Løk, 1 stk', 'Gulrot, 2 stk', 'Parmesan, til servering'],
        recipeLink: null,
        imageUrl: null
    },
    'd-pannekaker': {
        dish: 'Pannekaker med blåbær',
        ingredients: ['Hvetemel, 3 dl', 'Melk, 6 dl', 'Egg, 3 stk', 'Blåbær, 1 kurv', 'Sukker, 2 ss', 'Smør, til steking'],
        recipeLink: null,
        imageUrl: null,
        portions: '4',
        cookTime: '40 min'
    },
    'd-laks': {
        dish: 'Ovnsbakt laks med rotgrønnsaker',
        ingredients: ['Laksefilet, 600 g', 'Poteter, 6 stk', 'Gulrøtter, 4 stk', 'Brokkoli, 1 stk', 'Sitron, 1 stk', 'Rømme, 1 beger'],
        parsedIngredients: [
            { name: 'Laksefilet', quantity: '600 g' },
            { name: 'Poteter', quantity: '6 stk' },
            { name: 'Gulrøtter', quantity: '4 stk' },
            { name: 'Brokkoli', quantity: '1 stk' },
            { name: 'Sitron', quantity: '1 stk' },
            { name: 'Rømme', quantity: '1 beger' }
        ],
        recipeLink: null,
        imageUrl: null,
        portions: '4',
        cookTime: '35 min',
        steps: [
            'Kutt rotgrønnsakene i biter og bak dem i ovnen på 200 °C i 20 minutter.',
            'Legg laksen på brettet, krydre og press over litt sitron.',
            'Stek videre i 12–15 minutter til laksen er gjennomstekt.'
        ]
    },
    'd-kjottkaker': {
        dish: 'Kjøttkaker med ertestuing',
        ingredients: ['Kjøttkaker, 12 stk', 'Ertestuing, 1 pakke', 'Poteter, 8 stk', 'Brun saus, 5 dl', 'Tyttebærsyltetøy, til servering'],
        recipeLink: null,
        imageUrl: null
    }
};

const categories = [
    { id: 'kat-frukt', name: 'Frukt & Grønt', order: 0 },
    { id: 'kat-kjott', name: 'Kjøtt, Fisk & Fjærkre', order: 1 },
    { id: 'kat-meieri', name: 'Meieriprodukter & Egg', order: 2 },
    { id: 'kat-bakevarer', name: 'Bakevarer & Korn', order: 3 },
    { id: 'kat-torrvarer', name: 'Tørrvarer & Hermetikk', order: 4 },
    { id: 'kat-drikke', name: 'Drikkevarer', order: 5 },
    { id: 'kat-snacks', name: 'Snacks & Godteri', order: 6 },
    { id: 'kat-annet', name: 'Annet', order: 7 }
];

const shoppingItems = [
    { id: 'vare-1', name: 'Melk', categoryId: 'kat-meieri', checked: false, quantity: 2 },
    { id: 'vare-2', name: 'Grovbrød', categoryId: 'kat-bakevarer', checked: false, quantity: 1 },
    { id: 'vare-3', name: 'Epler', categoryId: 'kat-frukt', checked: false, quantity: 6 },
    { id: 'vare-4', name: 'Kyllingfilet', categoryId: 'kat-kjott', checked: false, quantity: 1 },
    { id: 'vare-5', name: 'Tacokrydder', categoryId: 'kat-torrvarer', checked: false, quantity: 1 },
    { id: 'vare-6', name: 'Tortillalefser', categoryId: 'kat-bakevarer', checked: false, quantity: 1 },
    { id: 'vare-7', name: 'Kaffe', categoryId: 'kat-drikke', checked: true, quantity: 1 },
    { id: 'vare-8', name: 'Revet ost', categoryId: 'kat-meieri', checked: false, quantity: 1 },
    { id: 'vare-9', name: 'Paprika', categoryId: 'kat-frukt', checked: false, quantity: 2 },
    { id: 'vare-10', name: 'Rømme', categoryId: 'kat-meieri', checked: true, quantity: 1 },
    { id: 'vare-11', name: 'Sjokolade', categoryId: 'kat-snacks', checked: false, quantity: 1 },
    { id: 'vare-12', name: 'Tørkerull', categoryId: 'kat-annet', checked: false, quantity: 1 }
];

const weekendItems = [
    { id: 'helg-1', name: 'Pølser', categoryId: 'kat-kjott', checked: false, quantity: 2 },
    { id: 'helg-2', name: 'Lomper', categoryId: 'kat-bakevarer', checked: false, quantity: 1 },
    { id: 'helg-3', name: 'Kakao', categoryId: 'kat-drikke', checked: false, quantity: 1 },
    { id: 'helg-4', name: 'Appelsiner', categoryId: 'kat-frukt', checked: false, quantity: 8 },
    { id: 'helg-5', name: 'Kvikk Lunsj', categoryId: 'kat-snacks', checked: false, quantity: 4 }
];

const checklistSections = [
    { id: 'seksjon-mat', name: 'Mat' },
    { id: 'seksjon-hus', name: 'Husholdning' },
    { id: 'seksjon-annet', name: 'Annet' }
];

const checklistItems = [
    { id: 'sjekk-1', name: 'Bake boller til helgen', section: 'Mat' },
    { id: 'sjekk-2', name: 'Lage matpakker', section: 'Mat' },
    { id: 'sjekk-3', name: 'Støvsuge stua', section: 'Husholdning' },
    { id: 'sjekk-4', name: 'Vaske badet', section: 'Husholdning' },
    { id: 'sjekk-5', name: 'Vanne blomstene', section: 'Husholdning' },
    { id: 'sjekk-6', name: 'Kjøpe bursdagsgave til Jonas', section: 'Annet' },
    { id: 'sjekk-7', name: 'Bestille time hos frisøren', section: 'Annet' }
];

// Returnerer [sti, data]-par som demo-backenden seed-er sitt dokumentlager med.
export function buildDemoDocs() {
    const docs = [];
    const fam = (sub) => `families/${DEMO_FAMILY_ID}/${sub}`;
    const today = new Date();

    docs.push([`users/${DEMO_USER.uid}`, { familyId: DEMO_FAMILY_ID }]);

    docs.push([`families/${DEMO_FAMILY_ID}`, {
        members: [
            { uid: DEMO_USER.uid, name: 'Kari', photoURL: '', role: 'admin' },
            { uid: 'demo-medlem-2', name: 'Ola', photoURL: '', role: 'member' },
            { uid: 'demo-medlem-3', name: 'Emma', photoURL: '', role: 'member' }
        ],
        createdAt: addDays(today, -120),
        defaultShoppingListId: 'liste-ukeshandel'
    }]);

    Object.entries(dinners).forEach(([id, data]) => {
        docs.push([fam(`dinnerArchive/${id}`), data]);
    });

    docs.push([fam(`weeklyPlans/${getWeekDocId(addDays(today, -7))}`), {
        mon: { dinnerId: 'd-bolognese' },
        tue: { dinnerId: 'd-fiskegrateng' },
        wed: { dinnerId: 'd-taco' },
        thu: { dinnerId: 'd-kjottkaker' },
        sun: { dinnerId: 'd-laks' }
    }]);
    docs.push([fam(`weeklyPlans/${getWeekDocId(today)}`), {
        mon: { dinnerId: 'd-karri' },
        tue: { dinnerId: 'd-pannekaker' },
        wed: { dinnerId: 'd-lasagne' },
        fri: { dinnerId: 'd-taco' },
        sat: { dinnerId: 'd-laks' },
        sun: { dinnerId: 'd-kjottkaker' }
    }]);
    docs.push([fam(`weeklyPlans/${getWeekDocId(addDays(today, 7))}`), {
        mon: { dinnerId: 'd-fiskegrateng' },
        wed: { dinnerId: 'd-bolognese' }
    }]);

    docs.push([fam('shoppingLists/liste-ukeshandel'), { name: 'Ukeshandel' }]);
    docs.push([fam('shoppingLists/liste-helg'), { name: 'Hyttetur' }]);
    shoppingItems.forEach(({ id, ...data }) => {
        docs.push([fam(`shoppingLists/liste-ukeshandel/items/${id}`), data]);
    });
    weekendItems.forEach(({ id, ...data }) => {
        docs.push([fam(`shoppingLists/liste-helg/items/${id}`), data]);
    });

    categories.forEach(({ id, ...data }) => {
        docs.push([fam(`shoppingListCategories/${id}`), { ...data, listId: null }]);
    });

    docs.push([fam('storeProfiles/profil-narbutikken'), {
        name: 'Nærbutikken',
        listId: null,
        categoryOrder: ['kat-frukt', 'kat-bakevarer', 'kat-meieri', 'kat-kjott', 'kat-torrvarer', 'kat-drikke', 'kat-snacks', 'kat-annet']
    }]);

    checklistSections.forEach(({ id, ...data }) => {
        docs.push([fam(`checklistSections/${id}`), data]);
    });
    checklistItems.forEach(({ id, ...data }) => {
        docs.push([fam(`checklistItems/${id}`), data]);
    });

    return docs;
}
