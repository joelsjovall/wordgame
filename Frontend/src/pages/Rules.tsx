import { Link } from 'react-router-dom';

function Rules() {
  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Rules</h1>

        <p>
          Varje runda väljer en spelare kategori och skriver hur många saker av den kategorin han kan nämna
          Efter första spelaren har valt kategori och antal ska nästa spelare antingen, klicka på bullshit eller att han kan säga mer
          än den andra spelaren inom samma kategori, trycker han bullshit så ska den första spelaren skriva så många saker från den kategorin som han kan på 60 sekunder
          lyckas han får han poäng och lyckas han inte får den spellaren som sa bullshit poäng
          Såhär fortsätter det till's att spelet är slut.

        </p>

        <div className="divider" aria-hidden="true"></div>
        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default Rules;
