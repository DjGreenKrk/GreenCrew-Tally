-- The Hub flashes precompiled my-*.lc (see tally/Makefile); .lua is a dev fallback.
-- NodeMCU can run sources too, but they may not fit into the heap at boot.
if file.exists("my-app.lc") then
    dofile("my-app.lc")
else
    dofile("my-app.lua")
end
