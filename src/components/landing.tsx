import Image from "next/image";
import KopiLogo from "./kopi-logo";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Heart,
  PawPrint,
  Receipt,
  RefreshCw,
  Smartphone,
  Wallet,
} from "lucide-react";
import "./landing.css";

type Props = {
  onSignup: () => void;
  onLogin: () => void;
  onDemo: () => void;
  onInstall: () => void;
};

export default function Landing({
  onSignup,
  onLogin,
  onDemo,
  onInstall,
}: Props) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="#" className="brand" aria-label="Kopi home">
          <KopiLogo />
          Kopi<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#about">What is Kopi?</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="landing-login" onClick={onLogin}>
            Sign in
          </button>
          <button className="primary" onClick={onSignup}>
            Get started <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span className="landing-kicker">
              <span /> SIMPLE BOOKS. A LITTLE MORE PEACE.
            </span>
            <h1 id="landing-title">
              Less money mess.
              <br />
              More <em>life.</em>
            </h1>
            <p>
              Meet Kopi. Your cozy little corner for tracking income,
              expenses, subscriptions, and receipts. So you can spend less time
              sorting numbers and more time on what you love.
            </p>
            <div className="landing-hero-actions">
              <button className="primary" onClick={onSignup}>
                Start your pocketbook <ArrowRight size={18} />
              </button>
              <button className="landing-demo" onClick={onDemo}>
                Take a look around <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="landing-benefits">
              <span>
                <Check size={14} /> Simple to use
              </span>
              <span>
                <Check size={14} /> Your own private book
              </span>
              <span>
                <Check size={14} /> Phone & web
              </span>
            </div>
          </div>
          <div className="landing-hero-art">
            <div className="landing-photo-frame">
              <Image
                src="/images/kopi-portrait.png"
                alt="Kopi, a fluffy cream-colored dog, relaxing with his favorite teddy bear"
                width={1254}
                height={1254}
                sizes="(max-width: 760px) 95vw, 46vw"
                preload
              />
              <span className="landing-photo-note">
                <PawPrint size={15} /> Meet Kopi. Chief happiness officer.
              </span>
            </div>
            <div className="landing-sticker">
              <Heart size={20} />
              <span>
                More time for
                <br />
                <strong>the good stuff.</strong>
              </span>
            </div>
          </div>
        </section>
        <div className="landing-ribbon">
          <span>A place for every peso.</span>
          <span>
            <Wallet size={18} /> Money in & out
          </span>
          <span>
            <RefreshCw size={18} /> Subscriptions
          </span>
          <span>
            <Receipt size={18} /> Receipts together
          </span>
          <span>
            <Smartphone size={18} /> With you, anywhere
          </span>
        </div>
        <section id="about" className="landing-about">
          <div>
            <span className="landing-kicker">
              A SMALL BOOK. A CLEARER PICTURE.
            </span>
            <h2>
              What is
              <br />
              <em>Kopi?</em>
            </h2>
          </div>
          <div>
            <p>
              Kopi is a simple personal bookkeeping app that brings your
              everyday finances into one place.
            </p>
            <p>
              Record money received, log what you spend, and keep receipts with
              each transaction. Your totals update as you go, so you always have
              a clearer picture of what’s left.
            </p>
            <a className="landing-inline-link" href="#features">
              A little organization goes a long way <ArrowRight size={17} />
            </a>
          </div>
        </section>
        <section id="features" className="landing-features">
          <div className="landing-section-intro">
            <span className="landing-kicker">EVERYDAY ESSENTIALS</span>
            <h2>
              Everything in its <em>happy place.</em>
            </h2>
            <p>The details you need. A little less to think about.</p>
          </div>
          <div className="landing-feature-grid">
            {[
              {
                icon: Wallet,
                title: "Know where your money goes",
                copy: "Track income and expenses in pesos. See your total money received, money spent, and remaining balance at a glance.",
                label: "A clearer picture",
                color: "sage",
              },
              {
                icon: RefreshCw,
                title: "Keep tabs on subscriptions",
                copy: "Record payments for ChatGPT, Claude, or any service you use. Find your subscription spending in one place.",
                label: "Little costs, all accounted for",
                color: "peach",
              },
              {
                icon: Receipt,
                title: "Give every receipt a home",
                copy: "Attach a photo or PDF to a transaction and view it when you need it. No more searching through your camera roll.",
                label: "Less searching, more finding",
                color: "lavender",
              },
              {
                icon: Download,
                title: "Take your records with you",
                copy: "Search your transactions, filter by month, and export your ledger to CSV whenever you need a spreadsheet copy.",
                label: "Your book, your way",
                color: "sand",
              },
            ].map(({ icon: Icon, title, copy, label, color }) => (
              <article key={title} className={"landing-feature " + color}>
                <span className="landing-feature-icon">
                  <Icon size={23} />
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="landing-feature-label">
                  {label}
                  <ArrowUpRight size={15} />
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-life">
          <div className="landing-collage">
            <Image
              src="/images/kopi-moments.png"
              alt="A collage of Kopi's everyday moments: relaxing on the sofa, playing, and cuddling a teddy bear"
              width={1254}
              height={1254}
              sizes="(max-width: 760px) 95vw, 46vw"
            />
            <span>
              Little moments. The really big things. <Heart size={15} />
            </span>
          </div>
          <div className="landing-life-copy">
            <span className="landing-kicker">
              <PawPrint size={15} /> A NOTE FROM KOPI
            </span>
            <h2>
              Life’s best things
              <br />
              aren’t on a<br />
              <em>spreadsheet.</em>
            </h2>
            <p>
              Afternoon walks. A favorite snack. A little time with your
              favorite people (and pups).
            </p>
            <p>
              Kopi helps you make sense of the numbers, so there’s a
              little more room for everything else.
            </p>
            <button className="landing-inline-link" onClick={onSignup}>
              Make room for the good stuff <ArrowRight size={18} />
            </button>
          </div>
        </section>
        <section id="how-it-works" className="landing-how">
          <div className="landing-section-intro">
            <span className="landing-kicker">ONE SMALL HABIT</span>
            <h2>
              A fresh start in <em>three little steps.</em>
            </h2>
          </div>
          <div className="landing-steps">
            {[
              [
                "01",
                "Open your book",
                "Create an account with your name and email. Your personal ledger starts fresh, ready for you.",
              ],
              [
                "02",
                "Add the little details",
                "Record income or an expense, choose a subscription if needed, and attach a receipt.",
              ],
              [
                "03",
                "Enjoy a clearer picture",
                "Check your balance, look back at your transactions, and keep building the habit.",
              ],
            ].map(([n, title, copy]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-mobile">
          <span className="landing-mobile-icon">
            <Smartphone size={30} />
          </span>
          <div>
            <h2>Your pocketbook. Actually in your pocket.</h2>
            <p>
              Use it on the web, or add it to your iPhone or Android home
              screen. Sign in to the same account to keep your records together.
            </p>
          </div>
          <button className="secondary" onClick={onInstall}>
            How to install <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="landing-final-cta">
          <PawPrint size={30} />
          <span className="landing-kicker">
            HERE’S TO FEELING A LITTLE MORE TOGETHER
          </span>
          <h2>
            Your next chapter?
            <br />
            <em>A little more organized.</em>
          </h2>
          <p>Start with one entry. We’ll help you keep the picture clear.</p>
          <button className="primary" onClick={onSignup}>
            Start your pocketbook <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="brand" href="#">
          <KopiLogo />
          Kopi<span className="brand-dot">.</span>
        </a>
        <span>Simple books. More room for life.</span>
        <span>
          Made for your everyday. <PawPrint size={14} />
        </span>
      </footer>
    </div>
  );
}
