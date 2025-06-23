import Flashcards from "./components/flashcards";

export default function Home() {
  return (
    <div className="h-screen min-w-screen overflow-x-hidden">
      <h1 className="text-6xl mt-24 font-bold text-center -mb-16 ">Language Flashcards</h1>
      <Flashcards />
    </div>
  );
}
