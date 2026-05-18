import { Route, Switch } from "wouter";
import AdminPanel from "./AdminPanel";
import Cliente from "./Cliente";

function App() {
  return (
    <Switch>
      <Route path="/admin" component={AdminPanel} />
      <Route path="/cliente" component={Cliente} />
      <Route path="/">
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-600 mb-4">B</h1>
            <h2 className="text-2xl font-bold">Sistema de Monitoramento</h2>
            <p className="text-slate-400 mt-2">Acesse /admin para o painel ou /cliente para a interface.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default App;
