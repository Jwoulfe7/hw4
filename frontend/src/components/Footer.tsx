import { Link } from 'react-router-dom'
import { openValet } from '../valet'
import Belt from './Belt'
import Crest from './Crest'
import SignalFlags from './SignalFlags'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="footer">
      <Belt variant="madras" />
      <div className="footer-flags">
        <SignalFlags />
        <p className="footer-flags-note">Our signal flags spell YALE. Naturally.</p>
      </div>
      <div className="footer-inner">
        <div className="footer-brand">
          <Crest size={54} />
          <div>
            <div className="brand-name">Yale Bulldog Blue</div>
            <p className="muted">Officially licensed Yale apparel, by Campus Customs of New Haven.</p>
            <p className="footer-signoff">Yours in navy, the Bulldog</p>
          </div>
        </div>
        <div>
          <h4>The Shop</h4>
          <Link to="/products">The Whole Wardrobe</Link>
          <Link to="/products?collection=colleges">Residential Colleges</Link>
          <Link to="/products?collection=family">For the Family</Link>
          <button className="footer-link-btn" onClick={openValet}>
            Summon the Valet
          </button>
        </div>
        <div>
          <h4>The Particulars</h4>
          <Link to="/about">About Us</Link>
          <a href="mailto:orderdept@campuscustoms.com">orderdept@campuscustoms.com</a>
          <span>(475) 301-4205</span>
          <span className="muted">Returns within 30 days, unworn with tags.</span>
        </div>
      </div>
      <div className="footer-legal">© {YEAR} Yale Bulldog Blue by Campus Customs · Officially Licensed</div>
    </footer>
  )
}
