// Registers and injects the custom minefield feature into deep-ocean biomes.
// Approximate encounter rate: 1 successful attempt per 320 eligible chunks.

ServerEvents.registry('worldgen/configured_feature', event => {
    event.create('deep_sea_minefield', 'kubejs:deep_sea_minefield')
        .withPlacement('kubejs:deep_sea_minefield', placement => {
            placement.modifiers(modifiers => {
                modifiers.minecraft
                    .rarityFilter(320)
                    .inSquare()
                    .heightmap('ocean_floor_wg')
                    .biome()
            })
        })
})

ServerEvents.registry('neoforge:biome_modifier', event => {
    event.create('add_deep_sea_minefields', 'add_features')
        .biomes('#allium:deep_oceans')
        .step('surface_structures')
        .features('kubejs:deep_sea_minefield')
})

ServerEvents.basicCommand('minefield', event => {
    const input = String(event.input).trim().toLowerCase()

    if (input != 'nearest') {
        event.player.tell('Usage: /minefield nearest')
        return
    }

    if (!event.player.hasPermissions(2)) {
        event.player.tell('You do not have permission to use this command.')
        return
    }

    const data = event.server.persistentData
    const raw = data.getString('alliumMinefieldCenters')

    if (raw.length == 0) {
        event.player.tell('No naturally generated minefields have been recorded yet.')
        return
    }

    const dimension = event.player.level.dimension.toString()
    const currentX = event.player.x
    const currentZ = event.player.z

    let nearestX = 0
    let nearestZ = 0
    let nearestDistanceSquared = Number.MAX_VALUE
    let found = false

    for (const entry of raw.split(';')) {
        const parts = entry.split(',')
        if (parts.length != 3 || parts[0] != dimension) continue

        const x = Number(parts[1])
        const z = Number(parts[2])
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue

        const dx = x - currentX
        const dz = z - currentZ
        const distanceSquared = dx * dx + dz * dz

        if (distanceSquared < nearestDistanceSquared) {
            nearestDistanceSquared = distanceSquared
            nearestX = Math.round(x)
            nearestZ = Math.round(z)
            found = true
        }
    }

    if (!found) {
        event.player.tell('No recorded minefields exist in this dimension.')
        return
    }

    const distance = Math.round(Math.sqrt(nearestDistanceSquared))
    const command = '/tp @s ' + nearestX + ' ~ ' + nearestZ

    // Vanilla component JSON provides a clickable suggest-command action without
    // loading blocked Java classes.
    event.player.tell({
        text: 'Nearest minefield: ',
        extra: [
            {
                text: command,
                color: 'aqua',
                underlined: true,
                clickEvent: {
                    action: 'suggest_command',
                    command: command
                },
                hoverEvent: {
                    action: 'show_text',
                    contents: {
                        text: 'Click to place this teleport command into chat'
                    }
                }
            },
            {
                text: ' (' + distance + ' blocks away)'
            }
        ]
    })
})
