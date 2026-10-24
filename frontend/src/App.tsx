import { Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'
import NavBar from './components/NavBar'
import RopeProgress from './components/RopeProgress'
import ScrollToTop from './components/ScrollToTop'
import Showcase from './components/Showcase'
import Valet from './components/Valet'
import About from './pages/About'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProductPage from './pages/ProductPage'
import Products from './pages/Products'
import Signup from './pages/Signup'

export default function App() {
  const { user } = useAuth()
  return (
    <div className="app">
      <ScrollToTop />
      <RopeProgress />
      <NavBar />
      <main className="main">
        <Showcase />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <Valet />
      {/* Keyed by shopper: logging in or out swaps in a fresh chat with that person's history. */}
      <ChatWidget key={user?.id ?? 'guest'} />
    </div>
  )
}
