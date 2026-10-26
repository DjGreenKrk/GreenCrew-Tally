# The firmware v2 logic as a program for Linux/macOS (see tally_sim.cpp)
CORE := ../lib/tally_core/src
VERSION := $(shell sed -n 's/^firmware_version = //p' ../platformio.ini)
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra

.build/gc-tally-sim: tally_sim.cpp $(wildcard $(CORE)/*.cpp $(CORE)/*.h) ../platformio.ini
	mkdir -p .build
	$(CXX) $(CXXFLAGS) -I$(CORE) -DGC_FIRMWARE_VERSION='"$(VERSION)"' -o $@ tally_sim.cpp $(wildcard $(CORE)/*.cpp)
