import Link from "next/link";
import "./landing.css";

export default function Home() {
  return (
    <main className="unishare-landing">
      {/* Navigation */}
      <nav>
        <div className="wrap">
          <Link className="logo" href="#">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              stroke="#0B5D5E"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="16" r="5" />
              <circle cx="21" cy="16" r="5" />
              <path d="M16 11.5v9" />
            </svg>
            UniShare
          </Link>
          <div className="nav-actions">
            <Link className="link" href="#">
              Log in
            </Link>
            <Link className="btn sm" href="/register">
              Create account
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="wrap">
          <div>
            <h1>
              Your campus,
              <br />
              one big{" "}
              <span>shared</span>
              <br />
              <span>shelf.</span>
            </h1>
            <p>
              Rent cameras, calculators, laptops and more from students of your
              own university. Verified with your university email, never open to
              outsiders.
            </p>
            <div className="cta">
              <Link className="btn" href="/register">
                Create account
              </Link>
              <Link className="btn ghost" href="#">
                Log in
              </Link>
            </div>
            <small>Only students with a university email can join.</small>
          </div>
          <div className="photo">
            <img
              src="/images/landing/hero-student.jpeg"
              alt="A smiling UniShare student in a red kameez with a white shawl, hands open in welcome, standing in a green campus garden"
            />
          </div>
        </div>
      </header>

      {/* What You Can Share */}
      <section className="share" aria-label="What you can share">
        <div className="wrap">
          <div className="col">
            <h2>Rent what you need for a day</h2>
            <p>
              Borrow a calculator for an exam, a charger when yours gives up, or a
              football for the weekend, all from a student on your campus.
            </p>
            <ul className="items">
              <li>
                <img
                  src="/images/landing/football.jpeg"
                  alt="Three footballs stacked on grass"
                  style={{ objectPosition: "50% 45%" }}
                />
                <span>Football</span>
              </li>
              <li>
                <img
                  src="/images/landing/laptop-charger.jpeg"
                  alt="Black laptop charger held in a hand"
                  style={{ objectPosition: "40% 55%" }}
                />
                <span>Laptop charger</span>
              </li>
              <li>
                <img
                  src="/images/landing/earphones.jpeg"
                  alt="Wired earphones on a wooden table"
                  style={{ objectPosition: "50% 60%" }}
                />
                <span>Earphones</span>
              </li>
              <li>
                <img
                  src="/images/landing/phone-charger.jpeg"
                  alt="White 45W phone charger with cable"
                  style={{ objectPosition: "50% 50%" }}
                />
                <span>Phone charger</span>
              </li>
              <li>
                <img
                  src="/images/landing/airpods.jpeg"
                  alt="AirPods in an open charging case"
                  style={{ objectPosition: "50% 40%" }}
                />
                <span>AirPods</span>
              </li>
              <li>
                <img
                  src="/images/landing/calculator.jpeg"
                  alt="Two transparent calculators held in a hand"
                  style={{ objectPosition: "50% 55%" }}
                />
                <span>Calculator</span>
              </li>
            </ul>
          </div>
          <div className="col">
            <h2>Share a ride to campus</h2>
            <p>
              Heading the same way? Offer a seat or find a ride with someone from
              your own university, by car or by rickshaw.
            </p>
            <ul className="items rides">
              <li>
                <img
                  src="/images/landing/car-ride.jpeg"
                  alt="Phone showing a Ride Share booking next to a white car on a Dhaka street"
                  style={{ objectPosition: "0% 50%" }}
                />
                <span>Car ride</span>
              </li>
              <li>
                <img
                  src="/images/landing/rickshaw.jpeg"
                  alt="A student with a backpack talking to a rickshaw puller while a passenger steps out of a painted rickshaw"
                  style={{ objectPosition: "28% 50%" }}
                />
                <span>Rickshaw</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how" id="how">
        <div className="wrap">
          <div className="how-head">
            <h2>Joining takes three moves</h2>
            <p className="lead">
              Every member is checked, so you always know the person on the other
              side is a real student.
            </p>
          </div>
          <ol>
            <li>
              <div className="top">
                <span className="num">1</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <rect x="3" y="7" width="34" height="26" rx="4" />
                  <path d="M4 10l16 12 16-12" />
                </svg>
              </div>
              <h3>Sign up with your university email</h3>
              <p>We send a 6-digit code to confirm the address is yours.</p>
            </li>
            <li>
              <div className="top">
                <span className="num">2</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <rect x="3" y="7" width="34" height="26" rx="4" />
                  <circle cx="14" cy="17" r="4" />
                  <path d="M7 28c1-5 12-5 14 0M24 16h9M24 22h9" />
                </svg>
              </div>
              <h3>Get verified</h3>
              <p>Add your student details, ID card and a face photo for review.</p>
            </li>
            <li>
              <div className="top">
                <span className="num">3</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <circle cx="14" cy="20" r="8" />
                  <circle cx="26" cy="20" r="8" />
                  <path d="M20 13.5v13" />
                </svg>
              </div>
              <h3>Rent or lend</h3>
              <p>
                Once approved, you only see items and rides from your own
                university.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="final">
        <div className="wrap">
          <h2>Ready to see what your campus has on the shelf?</h2>
          <div className="cta">
            <Link className="btn" href="/register">
              Create account
            </Link>
            <Link className="btn ghost" href="#">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          UniShare. Made for university students in Bangladesh.
        </div>
      </footer>
    </main>
  );
}
