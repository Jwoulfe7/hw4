import { Link } from 'react-router-dom'

const SPOTTING_GUIDE = [
  'The sweatshirt is navy, the crest is real, and the cuffs have been worn in by a few winters on Elm Street.',
  "There's a residential college on the chest, worn with the confidence of someone who's sure theirs is the best one.",
  'Parents wear "Yale Mom" or "Yale Dad" in airports, where it will start a conversation.',
  'Every November, the Harvard-Yale tee comes out, and it gets worn whatever the score was.',
]

export default function About() {
  return (
    <div className="page prose">
      <div className="page-head">
        <p className="kicker">About us</p>
        <h1>A field guide to Campus Customs</h1>
        <p className="lede">
          Like all good traditions, ours is mostly about the clothes.
        </p>
      </div>

      <section>
        <h2>Who we are</h2>
        <p>
          Campus Customs runs <strong>Yale Bulldog Blue</strong>, a New Haven shop for officially
          licensed Yale apparel. We stock the classics, in their proper colors: Yale blue, white,
          and heather gray that looks better every year you own it.
        </p>
        <p>
          We think a good crewneck should last longer than the semester. Ideally it should last
          until your own children borrow it for their freshman year and refuse to give it back.
        </p>
      </section>

      <section>
        <h2>What we carry</h2>
        <ul>
          <li>
            <strong>Residential colleges.</strong> Crests, crewnecks, and quarter-zips for colleges
            from Benjamin Franklin to Trumbull.
          </li>
          <li>
            <strong>Varsity.</strong> Left-chest wordmarks for crew, hockey, squash, sailing, and the
            rest of the teams.
          </li>
          <li>
            <strong>Family.</strong> Mom, Dad, Grandma, Grandpa, Aunt, Uncle, Brother, and Cousin.
            Nobody has to guess who they're cheering for.
          </li>
          <li>
            <strong>Graduate &amp; professional schools.</strong> Law, Medicine, Management,
            Divinity, Art, Architecture, and more, because a doctorate is no reason to stop
            wearing sweatshirts.
          </li>
          <li>
            <strong>The Game.</strong> Harvard-Yale tees for that one Saturday in November when
            everyone remembers which side they're on.
          </li>
        </ul>
      </section>

      <section>
        <h2>How to spot one of our customers</h2>
        <ol>
          {SPOTTING_GUIDE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2>House rules</h2>
        <p>
          You can return or exchange unworn items, with the original tags still on, within 30 days
          of shipping. If we made the mistake, we pay for return shipping. If you just changed your
          mind, that's fine too, but the postage is on you. Custom pieces, like our custom alumni
          items, are made just for you and so are final sale.
        </p>
      </section>

      <section>
        <h2>Write, call, or just ask</h2>
        <p>
          Email <a href="mailto:orderdept@campuscustoms.com">orderdept@campuscustoms.com</a> or call{' '}
          <a href="tel:+14753014205">(475) 301-4205</a>. For quick questions about sizes, stock, or
          which crewneck to buy, the Bulldog in the corner of the page is always on duty.
        </p>
        <p>
          <Link to="/products" className="btn">
            Browse the shop
          </Link>
        </p>
      </section>
    </div>
  )
}
