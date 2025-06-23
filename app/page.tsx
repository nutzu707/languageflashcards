import Flashcards from "./components/flashcards";

export default function Home() {
  return (
    <div className="h-screen min-w-screen overflow-x-hidden">
      <h1 className="text-4xl font-bold text-center mt-12">Language Flashcards</h1>
      <Flashcards />
    </div>
  );
}
