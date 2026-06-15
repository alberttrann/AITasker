import { Route, Routes } from "react-router-dom";
import ErrorPage from "@components/pages/ErrorPage";
import { LoginForm } from "@components/auth/Form";

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/home"></Route>
      <Route path="/*" element={<ErrorPage />}></Route>
    </Routes>
    
    </>
  )
}
