import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ABI from "./abi.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export function useWallet() {
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);

  async function connect() {
    if (!window.ethereum) return alert("Install MetaMask");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
  }

  return { signer, address, connect };
}

export function useContract(signer) {
  if (!CONTRACT_ADDRESS) return null;
  const provider = signer ?? new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}
