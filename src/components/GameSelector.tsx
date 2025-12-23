import type { Participant } from "../types/participant";
import { motion } from "framer-motion";

interface Props {
    participants: Participant[];
    onSelect: (game: string) => void;
}

// 참고
{/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {games.map((game, index) => {
          const Icon = game.icon;
          return (
            <motion.button
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onGameSelect(game.id)}
              className={`bg-gradient-to-br ${game.color} text-white rounded-xl p-6 hover:scale-105 transition-transform shadow-lg`}
            >
              <Icon className="w-12 h-12 mx-auto mb-3" />
              <h3 className="text-xl mb-2">{game.name}</h3>
              <p className="text-white/80 text-sm">{game.description}</p>
            </motion.button>
          );
        })}
      </div> */}

export function GameSelector({ participants, onSelect }: Props) {
    const games = [
        {
          id: 'roulette' as const,
          name: '🎡 돌림판',
          description: '룰렛을 돌려서 한 명을 선택합니다',
          color: 'from-blue-500 to-cyan-500',
        },
        {
          id: 'horse-race' as const,
          name: '🐎 경마',
          description: '말들이 경주해서 순위를 정합니다',
          color: 'from-green-500 to-emerald-500',
        },
        {
          id: 'soccer' as const,
          name: '⚽ 축구',
          description: '팀을 나눠서 축구 경기를 합니다',
          color: 'from-orange-500 to-red-500',
        },
      ];
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <h2>게임 선택</h2>
            {games.map((game, index) => (
                <motion.button key={game.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSelect(game.id)} className={`bg-gradient-to-br ${game.color} text-white rounded-xl p-6 hover:scale-105 transition-transform shadow-lg`}>
                    {game.name}
                </motion.button>
            ))}
        </div>
    );
}


