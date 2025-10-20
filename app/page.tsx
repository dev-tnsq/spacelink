"use client"

import { Header } from "@/components/header"
import { EarthBackground } from "@/components/earth-background";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Stats } from "@/components/stats";
import { HowItWorks } from "@/components/how-it-works";
import { TechStack } from "@/components/tech-stack";
import { Footer } from "@/components/footer";
import { Leva } from "leva";

export default function Home() {
  return (
    <>
      <Header />
      <EarthBackground />
      <Hero />
      <Features />
      <Stats />
      <HowItWorks />
      <TechStack />
      <Footer />
      <Leva hidden />
    </>
  );
}
