// Open "The Valet" (instant search) from anywhere, e.g. the nav button.
export const VALET_EVENT = 'campus-customs:open-valet'
export const openValet = () => window.dispatchEvent(new Event(VALET_EVENT))
