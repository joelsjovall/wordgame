import { Link } from 'react-router-dom';

function Rules() {
  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Rules</h1>

        <p>
          1. Starting a Round
          At the beginning of each round, one player chooses a category.

          The same player then declares how many items within that category they believe they can name.

          2. The Next Player’s Decision
          After the first player has made their claim, the next player must choose between two options:

          Call “Bullshit”

          This means they doubt the first player can name that many items.

          Raise the Bid

          They claim they can name more items in the same category than the previous player.

          3. If “Bullshit” Is Called
          The challenged player has 60 seconds to list as many items from the chosen category as they claimed.

          If they succeed, they earn the point.

          If they fail, the player who called “bullshit” earns the point.

          4. Continuing the Game
          The game continues in this manner until the predetermined endpoint (e.g., a set number of rounds or points).

        </p>

        <div className="divider" aria-hidden="true"></div>
        <Link className="rules-link" to="/">
          Back
        </Link>
      </section>
    </main>
  );
}

export default Rules;
