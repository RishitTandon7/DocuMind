"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function InteractiveTour() {
  useEffect(() => {
    const hasSeenTour = localStorage.getItem("documind_tour_seen");
    
    const startTourWhenReady = () => {
      // Check if username is set (meaning the modal is closed)
      const username = localStorage.getItem("documind_username");
      if (!username) {
        // Not ready yet, check again in 500ms
        setTimeout(startTourWhenReady, 500);
        return;
      }

      const hasSeenTour = localStorage.getItem("documind_tour_seen");
      if (!hasSeenTour) {
        const driverObj = driver({
          showProgress: true,
          animate: true,
          popoverClass: 'documind-driver-theme',
          steps: [
            {
              popover: {
                title: "Welcome to DocuMind 🚀",
                description: "Let's take a quick 4-step tour of what you can do.",
              }
            },
            {
              element: '#tour-scan-btn',
              popover: {
                title: "Scan Documents",
                description: "Use your camera to automatically detect edges, crop, and flatten physical documents. Try it out!",
                side: "bottom",
                align: 'center'
              }
            },
            {
              element: '#tour-upload-btn',
              popover: {
                title: "Upload Files",
                description: "Already have a file? Upload PDFs or images directly for instant analysis.",
                side: "bottom",
                align: 'center'
              }
            },
            {
              element: '#tour-ask-btn',
              popover: {
                title: "Chat with AI",
                description: "Ask questions about any of your scanned documents and get AI answers instantly.",
                side: "bottom",
                align: 'center'
              }
            },
            {
              element: '#tour-search-btn',
              popover: {
                title: "Global Search",
                description: "Looking for a specific document? Search through all your files and content here.",
                side: "top",
                align: 'center'
              }
            }
          ],
          onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
              localStorage.setItem("documind_tour_seen", "true");
              driverObj.destroy();
            }
          },
        });

        driverObj.drive();
      }
    };

    // Give the app loader time to finish, then start the polling process
    const timer = setTimeout(startTourWhenReady, 1000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
