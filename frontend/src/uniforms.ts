// "The Uniforms": head-to-toe outfits from the catalogue, as the Handbook would assemble them.
// Totals are computed from live catalogue prices; there is no bundle discount.

export type Uniform = {
  key: string
  title: string
  occasion: string
  note: string
  productIds: string[]
}

export const UNIFORMS: Uniform[] = [
  {
    key: 'the-game',
    title: 'The Game',
    occasion: 'Saturday in November',
    note: 'The tee for bragging rights, the crest for warmth, the bomber because the Bowl is drafty and you have standards.',
    productIds: ['2025-yale-vs-harvard-t-shirt', 'super-heavyweight-crewneck-arched-yale-crest', 'brooks-brothers-bomber-jacket-yale'],
  },
  {
    key: 'parents-weekend',
    title: "Parents' Weekend",
    occasion: 'October, with relatives',
    note: 'One for each of them, so nobody in the dining hall wonders whose family this is.',
    productIds: ['yale-mom-hoodie', 'yale-dad-crewneck', 'yale-grandpa-crewneck'],
  },
  {
    key: 'the-regatta',
    title: 'The Regatta',
    occasion: 'Spring, waterside',
    note: 'Left-chest wordmarks only. Loud logos are for people who have to tell you they row.',
    productIds: ['sailing-left-chest-hoodie', 'crew-left-chest-hoodie', 'saybrook-sweater-fleece-jacket'],
  },
  {
    key: 'reading-period',
    title: 'Reading Period',
    occasion: 'Sterling, after midnight',
    note: 'A hoodie with a deep hood, a tee you can sleep in, and a crewneck for the walk back.',
    productIds: ['basic-hoodie-big-yale', 'boola-boola-t-shirt', 'champion-reverse-weave-crewneck'],
  },
]
