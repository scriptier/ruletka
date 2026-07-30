//! Local demo of Chat Roulette matchmaking (no Freenet node required).

use freenet_roulette_common::Preferences;
use freenet_roulette_sim::Simulator;

fn main() {
    println!("=== Freenet Chat Roulette — local sim demo ===\n");

    let mut sim = Simulator::new();
    let a = sim.add_peer(1, Preferences::text_only());
    let b = sim.add_peer(2, Preferences::text_only());

    println!("Peers: {} and {}", sim.agents[a].short_id(), sim.agents[b].short_id());
    println!("Spinning both into the lobby...\n");

    sim.spin(a);
    sim.spin(b);

    if !sim.run_until_match(30) {
        eprintln!("No match within tick budget — try again or check prefs.");
        std::process::exit(1);
    }

    for v in sim.views() {
        println!(
            "  peer {} → {} (partner: {})",
            v.id,
            v.phase,
            v.partner.unwrap_or_else(|| "-".into())
        );
    }

    println!("\nChatting...");
    sim.chat(a, "hey — freenet stranger chat works").unwrap();
    sim.chat(b, "nice monoid 🎲").unwrap();
    sim.chat(a, "next?").unwrap();

    println!();
    for v in sim.views() {
        println!("── {} ──", v.id);
        for m in &v.messages {
            println!("  [{}] {}", m.author, m.body);
        }
    }

    println!("\nHitting Next on both...");
    sim.next(a);
    sim.next(b);
    for v in sim.views() {
        println!("  peer {} → {}", v.id, v.phase);
    }

    println!("\nDone. Run the UI with:  python3 -m http.server -d ui 8787");
    println!("Or: cargo test -p freenet-roulette-sim");
}
