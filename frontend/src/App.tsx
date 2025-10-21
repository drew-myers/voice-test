import "./App.css";
import { AgentExperienceProvider } from "./context/AgentExperienceContext";
import { AgentExperienceLayout } from "./components/AgentExperienceLayout";

function App() {
  return (
    <AgentExperienceProvider>
      <main className="app">
        <section className="panel">
          <AgentExperienceLayout />
        </section>
      </main>
    </AgentExperienceProvider>
  );
}

export default App;
