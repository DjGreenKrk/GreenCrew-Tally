-- Prefer compiled Lua when available; Windows standalone builds ship raw .lua.
-- NodeMCU can execute source files directly, so a cross-compiler is optional.
if file.exists("my-app.lc") then
    dofile("my-app.lc")
else
    dofile("my-app.lua")
end
