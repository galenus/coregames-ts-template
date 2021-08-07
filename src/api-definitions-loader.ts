import {CoreAPI} from "./core-api-declarations";
import axios from "axios";

const DEFAULT_API_DEFINITIONS_URL = "https://raw.githubusercontent.com/ManticoreGamesInc/platform-documentation/development/src/assets/api/CoreLuaAPI.json";

export async function loadApiDefinitions(url = DEFAULT_API_DEFINITIONS_URL): Promise<CoreAPI> {
    const response = await axios.get(DEFAULT_API_DEFINITIONS_URL);
    return response.data as CoreAPI;
}
