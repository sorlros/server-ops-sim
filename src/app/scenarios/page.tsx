import { listScenarioCatalog } from "@/application/usecases/scenario-usecases";
import { SimulatorClient } from "@/components/simulator/SimulatorClient";

export default function ScenariosPage() {
  return <SimulatorClient scenarios={listScenarioCatalog()} />;
}
