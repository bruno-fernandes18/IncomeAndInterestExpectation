import { calculateProjection } from '../../domain/interest/calculate-projection.js';
import { SimulationInputError } from '../../domain/interest/simulation-input.js';

/** HTTP adapter around the domain calculator. A replacement calculator can be injected. */
export function createSimulationHandler(calculator = calculateProjection) {
  return function handleSimulation(request, response, next) {
    try {
      return response.json(calculator(request.body));
    } catch (error) {
      if (error instanceof SimulationInputError) {
        return response.status(error.status).json({ error: error.code });
      }
      return next(error);
    }
  };
}
